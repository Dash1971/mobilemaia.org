"""Import the separately pinned famous-game study without repinning older guides."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'research-source/brilliant-study'
STUDY = 'studies/famous-brilliants-2026-11-28'
REPO = 'https://github.com/Dash1971/mobile-maia-research'
SITE = ROOT / 'site/research/brilliant-moves'


def update(commit):
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise ValueError('Use a full immutable research commit.')
    base = f'https://raw.githubusercontent.com/Dash1971/mobile-maia-research/{commit}/{STUDY}'
    with urlopen(base + '/web/website-files.json', timeout=30) as response:
        descriptor = json.load(response)
    if not 1 <= len(descriptor['files']) <= 80:
        raise ValueError('Unexpected study file count.')
    pending = []
    total = 0
    for row in descriptor['files']:
        source, target = row['source'], row['target']
        if '..' in Path(source).parts or Path(source).is_absolute():
            raise ValueError('Unsafe study source path.')
        dest = (ROOT / target).resolve()
        if not (dest.is_relative_to(SNAPSHOT.resolve()) or dest.is_relative_to(SITE.resolve())):
            raise ValueError('Study import may not change existing guides or browser assets.')
        if dest.suffix not in ('.html', '.css', '.js', '.json', '.webp', '.png', '.pgn', '.txt'):
            raise ValueError('Unexpected study asset type.')
        with urlopen(base + '/' + source, timeout=30) as response:
            data = response.read(1024 * 1024 + 1)
        total += len(data)
        if len(data) > 1024 * 1024 or total > 3 * 1024 * 1024:
            raise ValueError('Study exceeds bounded import budget.')
        if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
            raise ValueError('Pinned study bytes do not match its manifest.')
        pending.append((row, dest, data))
    for _, dest, data in pending:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    SNAPSHOT.mkdir(parents=True, exist_ok=True)
    (SNAPSHOT / 'manifest.json').write_text(json.dumps({'repository': REPO, 'commit': commit, 'study': STUDY, 'files': descriptor['files']}, indent=2) + '\n')


def manifest():
    path = SNAPSHOT / 'manifest.json'
    if not path.exists():
        return None
    value = json.loads(path.read_text())
    for row in value['files']:
        data = (ROOT / row['target']).read_bytes()
        if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
            raise ValueError(f'Pinned Brilliant study asset changed: {row["target"]}')
    return value


def index_card():
    value = manifest()
    if value is None:
        return ''
    card = json.loads((SNAPSHOT / 'index-card.json').read_text())
    return f'''<section class="research-feature famous-feature" aria-labelledby="brilliant-study-title"><div><p class="eyebrow">NEW RESEARCH · AIMING FOR 2.7</p><h2 id="brilliant-study-title">{html.escape(card['title'])}</h2><p>{html.escape(card['description'])}</p><a class="button" href="brilliant-moves/">Explore the famous games</a></div><a href="brilliant-moves/" class="feature-figure" aria-label="Explore the Brilliant-move study"><img src="brilliant-moves/figures/hero-opera.png" alt="The actual Opera Game position before Morphy’s queen sacrifice on b8." width="1280" height="720" fetchpriority="high"></a></section>'''


def render(page):
    value = manifest()
    if value is None:
        return {}
    body = (SNAPSHOT / 'article-body.html').read_text().replace('__RESEARCH_COMMIT__', value['commit'])
    text = page('Can a model spot a masterpiece?', 'We tested old and proposed Mobile Maia Brilliant classifiers on nine famous games and fourteen published landmarks. Explore the gains, misses and trade-offs.', 'research/brilliant-moves/', '../../', body)
    text = text.replace('</head>', '<link rel="stylesheet" href="brilliant.css"></head>')
    text = text.replace('</body>', '<script src="brilliant.js" defer></script></body>')
    text = text.replace('content="https://mobilemaia.org/assets/icon.png"', 'content="https://mobilemaia.org/research/brilliant-moves/figures/hero-opera.png"')
    return {SITE / 'index.html': text}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--update', required=True)
    args = parser.parse_args()
    update(args.update)
    subprocess.run([sys.executable, str(ROOT / 'tools/research.py')], check=True)
