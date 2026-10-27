# Asset provenance

All app assets below were copied unchanged on 2026-10-24 from
[`Dash1971/maia-chess-android` at cd2551f70f9dde903d4bf543c7ea309beecee58f](https://github.com/Dash1971/maia-chess-android/tree/cd2551f70f9dde903d4bf543c7ea309beecee58f).
No generated app screens or invented gameplay are used.

| Website file | Source path | Context |
| --- | --- | --- |
| `site/assets/icon.png` | `fastlane/metadata/android/en-US/images/icon.png` | Stable blue app branding |
| `site/assets/play.jpg` | `docs/screenshots/20260906_v0_live_game_opening.jpg` | September 2026 play example |
| `site/assets/analysis.png` | `docs/screenshots/20261003_v1_stable_2_2_analysis_board.png` | Stable 2.2, dual Maia and Stockfish |
| `site/assets/review.png` | `docs/screenshots/20261003_v0_stable_2_2_brilliant_review.png` | Stable 2.2, Byrne–Fischer review example |
| `site/assets/graph.jpg` | `docs/screenshots/20260906_v0_review_graph.jpg` | September 2026 evaluation-graph example |

Screenshots are illustrative and may differ from the current release. Display
frames, scaling, and positioning are CSS; screenshot image files are unedited.
They do not constitute release qualification evidence.

The app source is AGPL-3.0-only. Screenshot content includes upstream artwork,
including Lichess Chessground and Cburnett pieces by Colin M. L. Burnett, which
retain their respective rights and licences. Corresponding source and notices:

- [Pinned app source](https://github.com/Dash1971/maia-chess-android/tree/cd2551f70f9dde903d4bf543c7ea309beecee58f)
- [Pinned component notices](https://github.com/Dash1971/maia-chess-android/blob/cd2551f70f9dde903d4bf543c7ea309beecee58f/THIRD_PARTY_NOTICES.md)
- [Local copy of app notices](APP_NOTICES.md)

System fonts only; no third-party web fonts, icon libraries, remote image
requests, or image-generation service assets. The page's decorative checker
pattern, frames, and marks use CSS and ordinary text.

## Research guide

The guide text, research-index source and five SVG figures are imported unchanged
from [`Dash1971/mobile-maia-research` at 2ac32240764adda087056a5e159d7c31a20df1ca](https://github.com/Dash1971/mobile-maia-research/tree/2ac32240764adda087056a5e159d7c31a20df1ca).
Original documentation and figures are AGPL-3.0-only, copyright Mobile Maia
contributors. This is independent project research, not an official Maia-team
publication. `research-source/manifest.json` records each original path, local
destination and SHA-256; it is updated together with the imported source.

The guide's figures are `opening-switch`, `top-p-example`, `opening-mix`,
`costly-moves` and `match-scores`, copied byte-for-byte from
`guides/choosing-maia-settings/figures/*.svg`. HTML uses the source PNG captions
as alternative text for the corresponding SVG. Figures are scaled with CSS;
their values and content are not redrawn or altered. Full-size originals can be
opened from each figure. Reports, dataset provenance and reproduction tools
remain in the research repository, linked at the imported commit.

### Score reliability — 27 October 2026

The complete visual report and its four SVG figures are imported unchanged from
[`mobile-maia-research` at 74d8684db865753080da72c6f43b1973bbfd668e](https://github.com/Dash1971/mobile-maia-research/tree/74d8684db865753080da72c6f43b1973bbfd668e/studies/score-reliability-2026-10-27).
Original report text and figures follow the research repository's AGPL-3.0-only
licence; third-party material retains its upstream terms. The report's alternative
text is preserved when using the original SVG counterparts of its PNG figures.

The published figures are `visual-results-1600`, `visual-results-2600`,
`example-board` and `visual-worked-example`, under
`site/research/figures/score-reliability/`. The board is the exact recorded position
rendered by the source study's pinned chess library; see its
[board generator](https://github.com/Dash1971/mobile-maia-research/blob/74d8684db865753080da72c6f43b1973bbfd668e/studies/score-reliability-2026-10-27/build_example_board.py)
and [source provenance](https://github.com/Dash1971/mobile-maia-research/blob/74d8684db865753080da72c6f43b1973bbfd668e/studies/score-reliability-2026-10-27/README.md#source-provenance-and-attribution).
Figure bytes and the report are hashed in `research-source/manifest.json`.
Source data, model weights and inference tools are not served by the website.
