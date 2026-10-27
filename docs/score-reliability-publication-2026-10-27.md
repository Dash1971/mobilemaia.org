# Maia score reliability publication

Date: 2026-10-27 (Asia/Tokyo).

## Source and presentation

- Research source commit: `74d8684db865753080da72c6f43b1973bbfd668e`.
- `/research/score-reliability/` publishes the complete source visual report,
  “Understanding Maia’s score %”, with four byte-identical SVG counterparts of
  its PNG figures. The original alternative descriptions and report text are
  preserved; site navigation, provenance and an introduction are added.
- The research index lists this study first and opens the locally served report.
  Detailed limitations and reproducible evidence link to the pinned research
  repository. The source snapshot, sitemap and asset provenance are updated.
- The renderer now supports the report's third-level headings and horizontal
  rule, and resolves imported figures in the new study's own asset directory.
- No app behavior, release, model, DNS or certificate configuration changed.
  No companion Stable/Preview app port applies to this website publication.

## Verification

- `python3 tools/research.py --check`: imported hashes and generated pages match.
- `python3 tools/check_site.py`: all six HTML pages, local assets, anchors and
  ARIA targets pass; total served content is below the existing 5 MiB limit.
- The existing settings guide differs only in its research pin and stylesheet
  cache version; an exact normalized comparison verified its preservation.
- All 14 pinned research-file links across the research pages exist in the
  complete source tree.
- Headline values were compared with the source calibration CSV, numerical
  summary and isolated-case calculation check: 500 games at each rating,
  9/100 and 15/100 consistency gaps above 10 points, the 78-game group near
  31% predicted versus 19% actual, and the 46.3% versus 30.5% worked example.
- Browser review at desktop width 1470 and phone widths 390 and 320: no
  page-level horizontal overflow; heading hierarchy, table of contents, all
  four figure loads and full-size board link were checked. The first index
  study's report link opens the new local page. Pages need no JavaScript.
- `git diff --check` passes. The imported Matplotlib `visual-*.svg` files keep
  the source's trailing path-data whitespace through a narrowly scoped
  `.gitattributes` rule, so their byte hashes remain identical to the research
  originals. GitHub Actions checks and deploys the static output.

The task-owned preview server is stopped at completion. Only small publication
sources and original figures are retained; no model, inference environment,
game archive or large dataset was downloaded for this website change.
