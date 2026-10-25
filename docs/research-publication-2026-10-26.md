# Research index and visual guide

Date: 2026-10-26 (Asia/Tokyo).

## Source and scope

- Research source: `Dash1971/mobile-maia-research` commit
  `2ac32240764adda087056a5e159d7c31a20df1ca`.
- `/research/` introduces all three source studies; their reports, data and
  reproduction tools remain in the dedicated research repository.
- `/research/choosing-maia-settings/` publishes the complete visual guide,
  including five original SVG figures, the comparison table, methods disclosure,
  source links and uncertainty footnote. Source text, alt descriptions and numbers
  are preserved. Article headings, navigation, context and layout are added here.
- The importer records byte hashes for all eight imported files. The two HTML
  pages regenerate offline and CI rejects modified source or stale output.
- No application source, defaults, Stable/Preview release gates or build tooling
  changed. No companion app port applies to this website-only publication.

## Verification

- `python3 tools/research.py --check`: source hashes and exact HTML match.
- `python3 tools/check_site.py`: all five HTML pages, including nested research
  routes, checked for local references, fragments, ARIA targets and assets.
- All 11 distinct pinned research-file links were checked against the complete
  source commit tree; none were missing.
- `git diff --check` passed.
- Browser review: default desktop width 1470, tablet width 850 and phone widths
  390 and 320. No page-level horizontal overflow in the reviewed layouts.
- Home navigation leads to the research index and the index opens the guide.
  Header links remain separate at tablet width and wrap on phones.
- The guide table scrolls within its labeled region, including via ArrowRight
  with keyboard focus; a phone hint explains the horizontal scroll.
- All five figures loaded. A full-size figure link opened the original local
  SVG. The methods disclosure opened, and the uncertainty footnote and its return
  target are present. Research pages contain no scripts and require no JavaScript.

Only `site/` is deployed. The published files remain below the existing 5 MiB
budget. No models, APKs, source datasets, environments or archives were downloaded.
The task-owned local preview server is stopped at completion. The small imported
source snapshot and figures are intentionally retained as maintained source.
