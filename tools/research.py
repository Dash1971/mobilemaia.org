#!/usr/bin/env python3
"""Import a pinned public research snapshot and render its small Markdown subset.

python3 tools/research.py --update <40-character research commit>
python3 tools/research.py          # regenerate offline from the recorded snapshot
python3 tools/research.py --check  # verify hashes and generated pages without writes

Only this publisher's documented Markdown subset is supported. Unexpected block
syntax fails rather than silently disappearing. No runtime dependencies/network.
"""
import argparse
import hashlib
import html
import json
import posixpath
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'research-source'
SITE = ROOT / 'site'
REPO = 'https://github.com/Dash1971/mobile-maia-research'
GUIDE = 'guides/choosing-maia-settings/README.md'
FIGURES = ('opening-switch', 'top-p-example', 'opening-mix', 'costly-moves', 'match-scores')
SCORE_STUDY = 'studies/score-reliability-2026-10-27'
SCORE_REPORT = f'{SCORE_STUDY}/REPORT.md'
SCORE_FIGURES = ('visual-results-1600', 'visual-results-2600', 'example-board', 'visual-worked-example')


def source_url(path, commit):
    return f'{REPO}/blob/{commit}/{path}'


def target_url(raw, source_path, commit, image=False):
    url = urlsplit(raw)
    if url.scheme or url.netloc:
        if url.scheme not in ('https', 'http'):
            raise ValueError(f'Unsupported URL: {raw}')
        return raw
    path = posixpath.normpath(posixpath.join(posixpath.dirname(source_path), url.path))
    if image:
        name = Path(path).stem
        if name in SCORE_FIGURES and path.startswith(f'{SCORE_STUDY}/figures/'):
            return f'../figures/score-reliability/{name}.svg'
        if name not in FIGURES or not path.startswith('guides/choosing-maia-settings/figures/'):
            raise ValueError(f'Unimported image: {raw}')
        return f'../figures/{name}.svg'
    if source_path == 'README.md' and path == SCORE_REPORT:
        return 'score-reliability/'
    result = source_url(path, commit)
    return result + (f'#{url.fragment}' if url.fragment else '')


def inline(text, source_path, commit):
    # Tokenize links before emphasis; escape every source-supplied text/URL.
    pattern = r'\[\^([^\]]+)\]|\[([^\]]+)\]\(([^\s)]+)\)|(`[^`]+`|\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*[^*]+\*)'
    parts, end = [], 0
    for match in re.finditer(pattern, text):
        parts.append(html.escape(text[end:match.start()]))
        footnote, label, url, emphasis = match.groups()
        if footnote:
            if not re.fullmatch(r'\d+', footnote):
                raise ValueError('Only numeric footnotes are supported')
            parts.append(f'<sup id="ref-{footnote}"><a href="#note-{footnote}" aria-label="Footnote {footnote}">{footnote}</a></sup>')
        elif label:
            href = html.escape(target_url(url, source_path, commit), quote=True)
            parts.append(f'<a href="{href}">{html.escape(label)}</a>')
        elif emphasis.startswith('`'):
            parts.append(f'<code>{html.escape(emphasis[1:-1])}</code>')
        elif emphasis.startswith('***'):
            parts.append(f'<strong><em>{html.escape(emphasis[3:-3])}</em></strong>')
        elif emphasis.startswith('**'):
            parts.append(f'<strong>{html.escape(emphasis[2:-2])}</strong>')
        else:
            parts.append(f'<em>{html.escape(emphasis[1:-1])}</em>')
        end = match.end()
    parts.append(html.escape(text[end:]))
    return ''.join(parts)


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def markdown(text, source_path, commit):
    lines = text.splitlines()
    output, paragraph, headings, notes = [], [], [], []
    in_list = False

    def flush():
        if paragraph:
            output.append('<p>' + inline(' '.join(paragraph), source_path, commit) + '</p>')
            paragraph.clear()

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if in_list and not line.startswith('- '):
            output.append('</ul>')
            in_list = False
        if not line:
            flush()
        elif line.startswith('# '):
            flush()  # The source title is rendered in the page header.
        elif line.startswith(('## ', '### ')):
            flush()
            level, title = line.split(' ', 1)
            level = len(level)
            ident = slug(title)
            if level == 2:
                headings.append((ident, title))
            output.append(f'<h{level} id="{ident}">{html.escape(title)}</h{level}>')
        elif line == '---':
            flush()
            output.append('<hr>')
        elif re.fullmatch(r'!\[.*\]\(.+\)', line):
            flush()
            alt, path = re.fullmatch(r'!\[(.*)\]\((.+)\)', line).groups()
            src = target_url(path, source_path, commit, image=True)
            figure_path = SITE / 'research' / Path(src).relative_to('..')
            svg = ET.parse(figure_path).getroot()
            _, _, width, height = svg.attrib['viewBox'].split()
            output.append(f'<figure class="research-figure"><img src="{src}" alt="{html.escape(alt, quote=True)}" width="{round(float(width))}" height="{round(float(height))}" loading="lazy"><figcaption><a href="{src}">Open full-size figure <span aria-hidden="true">↗</span></a></figcaption></figure>')
        elif line.startswith('|'):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([cell.strip() for cell in lines[i].strip().strip('|').split('|')])
                i += 1
            if len(rows) < 3 or not all(re.fullmatch(r':?-+:?', cell) for cell in rows[1]):
                raise ValueError('Unsupported table')
            output.append('<div class="table-scroll" role="region" aria-label="Tested sampling settings" tabindex="0"><table><caption>Temperature / Top-P in each part of the game<span class="table-hint">Scroll sideways to see all columns.</span></caption><thead><tr>')
            output.extend(f'<th scope="col">{inline(cell, source_path, commit)}</th>' for cell in rows[0])
            output.append('</tr></thead><tbody>')
            for row in rows[2:]:
                if len(row) != len(rows[0]):
                    raise ValueError('Inconsistent table columns')
                output.append('<tr>')
                for j, cell in enumerate(row):
                    tag = 'th scope="row"' if j == 0 else 'td'
                    closing = 'th' if j == 0 else 'td'
                    output.append(f'<{tag}>{inline(cell, source_path, commit)}</{closing}>')
                output.append('</tr>')
            output.append('</tbody></table></div>')
            continue
        elif line in ('<details>', '</details>'):
            flush()
            output.append(line)
        elif line.startswith('<summary>') and line.endswith('</summary>'):
            flush()
            output.append('<summary>' + html.escape(line[9:-10]) + '</summary>')
        elif line.startswith('- '):
            flush()
            if not in_list:
                output.append('<ul>')
                in_list = True
            output.append('<li>' + inline(line[2:], source_path, commit) + '</li>')
        elif re.match(r'^\[\^\d+\]: ', line):
            flush()
            number, note = re.fullmatch(r'\[\^(\d+)\]: (.+)', line).groups()
            notes.append(f'<li id="note-{number}">{inline(note, source_path, commit)} <a href="#ref-{number}" aria-label="Return to footnote {number} reference">↩</a></li>')
        elif re.match(r'^(<|#|>|```|\d+\. )', line):
            raise ValueError(f'Unsupported Markdown block: {line}')
        else:
            paragraph.append(line)
        i += 1
    flush()
    if in_list:
        output.append('</ul>')
    if notes:
        output.append('<aside class="research-notes" aria-label="Research footnotes"><ol>' + ''.join(notes) + '</ol></aside>')
    return '\n'.join(output), headings


def header(prefix):
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="container header-inner">
<a class="brand" href="{prefix}" aria-label="Mobile Maia home"><img src="{prefix}assets/icon.png" alt="" width="38" height="38"><span>Mobile Maia<span class="brand-dot">.</span></span></a>
<nav aria-label="Main navigation"><a href="{prefix}#features">The app</a><a href="{prefix}research/" aria-current="page">Research</a><a class="button button-small" href="{prefix}#download">Get the app <span aria-hidden="true">↗</span></a></nav>
</div></header>'''


def page(title, description, path, prefix, body):
    return f'''<!doctype html>
<!-- Generated by tools/research.py. Edit the pinned research source, not this page. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} — Mobile Maia</title><meta name="description" content="{html.escape(description, quote=True)}">
<meta name="theme-color" content="#f7f6f2"><meta property="og:type" content="article"><meta property="og:title" content="{html.escape(title, quote=True)} — Mobile Maia"><meta property="og:description" content="{html.escape(description, quote=True)}"><meta property="og:url" content="https://mobilemaia.org/{path}"><meta property="og:image" content="https://mobilemaia.org/assets/icon.png"><meta name="twitter:card" content="summary">
<link rel="canonical" href="https://mobilemaia.org/{path}"><link rel="icon" href="{prefix}assets/icon.png" type="image/png"><link rel="stylesheet" href="{prefix}styles.css?v=20261026"><link rel="stylesheet" href="{prefix}research.css?v=20261027"></head>
<body>{header(prefix)}{body}
<footer class="container site-footer"><div><a class="brand" href="{prefix}">Mobile Maia<span class="brand-dot">.</span></a><p>Independent research. Open methods.</p></div><div class="footer-links"><a href="{prefix}research/">Research index</a><a href="{REPO}">Research source ↗</a><a href="{prefix}about.html">Privacy &amp; credits</a><a href="https://github.com/Dash1971/mobilemaia.org">Website source ↗</a></div><p class="footer-small">© 2026 Mobile Maia contributors · AGPL-3.0-only · No added analytics or tracking.</p></footer>
</body></html>
'''


def render(manifest):
    commit = manifest['commit']
    guide = (SOURCE / 'guide.md').read_text()
    guide_title = guide.splitlines()[0][2:]
    content, headings = markdown(guide, GUIDE, commit)
    toc = ''.join(f'<li><a href="#{ident}">{html.escape(title)}</a></li>' for ident, title in headings)
    provenance = f'<a href="{source_url(GUIDE, commit)}">Read the original guide ↗</a><span>Source <a href="{REPO}/commit/{commit}">{commit[:7]}</a> · Study completed 18 October 2026</span>'
    guide_body = f'''<main id="main" class="container research-page">
<p class="breadcrumb"><a href="../">Research</a><span aria-hidden="true"> / </span>Choosing Maia settings</p>
<header class="research-title"><p class="eyebrow">A VISUAL GUIDE · MAIA-3 SAMPLING</p><h1>{html.escape(guide_title)}</h1><p class="research-deck">A wide choice of openings. Fewer unlikely mistakes. The evidence behind one proposed balance.</p><div class="research-provenance">{provenance}</div></header>
<div class="research-layout"><aside class="research-toc"><nav aria-label="On this page"><p>In this guide</p><ol>{toc}</ol></nav></aside>
<article class="research-article" aria-label="Visual settings guide"><aside class="research-context"><strong>Independent Mobile Maia research.</strong> This guide describes the tested 79M model and a proposed playing setting. It is not an official Maia-team recommendation or a promise of human-rated Elo. See <a href="https://github.com/Dash1971/maia-chess-android/releases">app release notes</a> for current availability and defaults.</aside>
{content}
<div class="research-end"><a class="text-link" href="../">← Explore the other studies</a><p>Text and figures are published from the same pinned research snapshot. <a href="{source_url(GUIDE, commit)}">Methods, data and source ↗</a></p></div></article></div></main>'''

    readme = (SOURCE / 'README.md').read_text()
    studies = readme.split('## Studies\n', 1)[1].split('## Attribution', 1)[0]
    study_html = []
    for section in re.split(r'^### ', studies, flags=re.M)[1:]:
        title, rest = section.split('\n', 1)
        paragraphs = rest.strip().split('\n\n')
        links = paragraphs[0]
        # The first two summary sentences introduce the work without presenting
        # dated application-default statements as the current app release state.
        summary = re.split(r'(?<=\.)\s+', ' '.join(paragraphs[1].split()))[:2]
        study_html.append(f'<article class="research-study"><h3>{html.escape(title)}</h3><p>{inline(" ".join(summary), "README.md", commit)}</p><p class="study-links">{inline(links, "README.md", commit)}</p></article>')
    if len(study_html) != 4:
        raise ValueError('Research index changed; review the study extraction before publishing')
    index_body = f'''<main id="main" class="container research-page">
<header class="research-title research-index-title"><p class="eyebrow">THE QUESTIONS BEHIND THE SETTINGS</p><h1>A closer look at<br><em>human-like chess.</em></h1><p class="research-deck">Experiments into how Maia chooses moves and forecasts human results, and what that means for playing on your phone.</p><p class="research-intro">Independent research by the Mobile Maia project. Read the findings here, then follow the evidence: methods, recorded games, datasets and reproduction tools are openly available.</p></header>
<section class="research-feature" aria-labelledby="visual-guide-title"><div><p class="eyebrow">START HERE · VISUAL GUIDE</p><h2 id="visual-guide-title">Choosing Maia settings.</h2><p>What happens when you keep the opening variety and trim the least likely moves? Follow the worked Top-P example, opening comparisons and match results.</p><a class="button" href="choosing-maia-settings/">Read the visual guide <span aria-hidden="true">→</span></a></div><a href="choosing-maia-settings/" class="feature-figure" aria-label="Read the visual settings guide"><img src="figures/opening-switch.svg" alt="Full sampling for the first five moves by each side, then Temperature 1.0 and Top-P 0.95 from move 6." width="792" height="425" fetchpriority="high"></a></section>
<section class="research-studies" aria-labelledby="studies-title"><div class="study-heading"><p class="eyebrow">FOLLOW THE EVIDENCE</p><h2 id="studies-title">The studies.</h2><p>Full reports and reproducible evidence in the research repository.</p></div>{''.join(study_html)}</section>
<aside class="research-context research-index-context"><h2>Findings, with their limits.</h2><p>These are independent Mobile Maia experiments, not official Maia-team publications. Results describe the tested models, positions and match conditions. Stronger play does not by itself establish more human-like choices, and selected rating inputs are not calibrated competitive Elo ratings.</p><p>Research proposals and released app behavior are separate. See the <a href="https://github.com/Dash1971/maia-chess-android/releases">Stable release notes</a> and <a href="https://github.com/Dash1971/maia-chess-android-preview">experimental Preview channel</a> for implementation status.</p><p><a href="{source_url('README.md', commit)}">Browse this research snapshot ↗</a> · Source <a href="{REPO}/commit/{commit}">{commit[:7]}</a></p></aside>
<aside class="research-context research-index-context"><h2>Try browser inference.</h2><p>The <a href="../lab/inference/">experimental inference benchmark</a> compares Maia 5M (the default) and 79M on your own device, with correctness checks and local timing results. The first CPU run downloads about 36 MB for 5M or 331 MB for 79M, only when you start a test.</p></aside>
</main>'''
    score = (SOURCE / 'score-reliability/REPORT.md').read_text()
    score_title = score.splitlines()[0][2:]
    score_content, score_headings = markdown(score, SCORE_REPORT, commit)
    score_toc = ''.join(f'<li><a href="#{ident}">{html.escape(title)}</a></li>' for ident, title in score_headings)
    score_body = f'''<main id="main" class="container research-page">
<p class="breadcrumb"><a href="../">Research</a><span aria-hidden="true"> / </span>Maia score reliability</p>
<header class="research-title"><p class="eyebrow">A VISUAL GUIDE · SCORE RELIABILITY</p><h1>{html.escape(score_title)}</h1><p class="research-deck">What the percentage means, how it compares with human results, and why it can jump after a move.</p><div class="research-provenance"><a href="{source_url(SCORE_REPORT, commit)}">Read the original report ↗</a><span>Source <a href="{REPO}/commit/{commit}">{commit[:7]}</a> · Study published 27 October 2026</span></div></header>
<div class="research-layout"><aside class="research-toc"><nav aria-label="On this page"><p>In this guide</p><ol>{score_toc}</ol></nav></aside>
<article class="research-article" aria-label="Maia score reliability guide"><aside class="research-context"><strong>Independent Mobile Maia research.</strong> These tests use the Maia-3 79M model and normal-ending online blitz games near 1600 and 2600. The <a href="{source_url(f'{SCORE_STUDY}/APPENDIX.md', commit)}">detailed results and limitations</a> explain the sample and what the findings can establish.</aside>
{score_content}
<div class="research-end"><a class="text-link" href="../">← Explore the other studies</a><p>Text and original figures are published from the same pinned research snapshot. <a href="{source_url(f'{SCORE_STUDY}/README.md', commit)}">Data, methods and reproduction ↗</a></p></div></article></div></main>'''
    return {
        SITE / 'research/index.html': page('Research', 'Independent Mobile Maia research into score reliability, sampling, opening variety and move history. Explore visual guides and reproducible evidence.', 'research/', '../', index_body),
        SITE / 'research/choosing-maia-settings/index.html': page('Choosing Maia settings', 'A visual guide to Temperature 1.0, Top-P 0.95 and opening variety, with measured results and links to the full Mobile Maia study.', 'research/choosing-maia-settings/', '../../', guide_body),
        SITE / 'research/score-reliability/index.html': page('Understanding Maia’s score %', 'What Maia’s expected-score percentage means, how it compares with human game results, and why individual estimates can jump after a move.', 'research/score-reliability/', '../../', score_body),
    }


def safe_svg(data):
    svg = ET.fromstring(data)
    for element in svg.iter():
        if element.tag.rsplit('}', 1)[-1] in ('script', 'foreignObject'):
            raise ValueError('Active SVG content is not allowed')
        for attr, value in element.attrib.items():
            name = attr.rsplit('}', 1)[-1]
            if name.startswith('on') or (name == 'href' and not value.startswith('#')):
                raise ValueError('Active or external SVG reference')
        if element.tag.endswith('style') and re.search(r'@import|https?://', element.text or ''):
            raise ValueError('External SVG stylesheet')


def update(commit):
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise ValueError('--update requires an immutable, full research commit SHA')
    imports = {
        'README.md': SOURCE / 'README.md',
        GUIDE: SOURCE / 'guide.md',
        'guides/choosing-maia-settings/figure-values.json': SOURCE / 'figure-values.json',
        **{f'guides/choosing-maia-settings/figures/{name}.svg': SITE / f'research/figures/{name}.svg' for name in FIGURES},
        SCORE_REPORT: SOURCE / 'score-reliability/REPORT.md',
        **{f'{SCORE_STUDY}/figures/{name}.svg': SITE / f'research/figures/score-reliability/{name}.svg' for name in SCORE_FIGURES},
    }
    downloads = []
    for source_path, dest in imports.items():
        url = f'https://raw.githubusercontent.com/Dash1971/mobile-maia-research/{commit}/{source_path}'
        with urlopen(url, timeout=30) as response:
            data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise ValueError(f'Unexpected source size: {source_path}')
        if dest.suffix == '.svg':
            safe_svg(data)
        downloads.append((source_path, dest, data))
    files = []
    for source_path, dest, data in downloads:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        files.append({'source': source_path, 'local': str(dest.relative_to(ROOT)), 'sha256': hashlib.sha256(data).hexdigest()})
    (SOURCE / 'manifest.json').write_text(json.dumps({'repository': REPO, 'commit': commit, 'licence': 'AGPL-3.0-only', 'files': files}, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--update', metavar='COMMIT')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.update and args.check:
        parser.error('--update and --check are mutually exclusive')
    if args.update:
        update(args.update)
    manifest = json.loads((SOURCE / 'manifest.json').read_text())
    for item in manifest['files']:
        data = (ROOT / item['local']).read_bytes()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError(f'Imported research source changed: {item["local"]}')
        if item['local'].endswith('.svg'):
            safe_svg(data)
    for path, text in render(manifest).items():
        if args.check:
            if not path.exists() or path.read_text() != text:
                raise ValueError(f'Generated research page is stale: {path.relative_to(ROOT)}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    print(f'PASS: research source hashes and pages match {manifest["commit"]}.')


if __name__ == '__main__':
    main()
