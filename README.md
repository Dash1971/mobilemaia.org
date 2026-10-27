# mobilemaia.org

The public website for [Mobile Maia](https://github.com/Dash1971/maia-chess-android),
an independent, free and open-source Android chess app built around Maia-3.

Plain HTML, CSS, and a small progressive-enhancement script. No package manager,
framework, runtime build step, external fonts, analytics or cookies. The homepage
and research articles use no browser storage; the opt-in browser previews are described below.
Only `site/` is deployed. APKs and model binaries stay in the app's distribution
channels.

## Preview and check

```sh
python3 tools/check_site.py
python3 -m http.server 8080 --bind 127.0.0.1 --directory site
```

Open <http://127.0.0.1:8080>. Stop the server with Ctrl-C when finished.
Check narrow and wide layouts, screenshot selection/enlargement, FAQ disclosure,
keyboard focus, downloads, and the no-JavaScript fallback after relevant changes.

## Hosting

Canonical address: [mobilemaia.org](https://mobilemaia.org/).
The original [GitHub Pages address](https://dash1971.github.io/mobilemaia.org/)
redirects to the configured custom domain.
Pushes to `main` validate the site, upload only `site/`, and deploy through
GitHub Actions. Pull requests validate without deploying. In repository
Settings → Pages, use **GitHub Actions** as the source.

The domain is registered at 1984, which also hosts its DNS. GitHub has verified
ownership and attached the domain to this site's Pages configuration. See
[domain setup](docs/domain-setup.md) for the DNS records, certificate setup,
and checks used to complete the cutover. No paid 1984 hosting package is needed.

## Content and assets

### Research publication

`/research/` introduces the four published studies and links to locally served
visual guides to playing settings and score reliability. The dedicated research
repository remains the source for
the text, figures, reports, datasets and reproduction tools. Research proposals
are distinguished from released app behavior and upstream Maia recommendations.

`research-source/manifest.json` pins the research commit and SHA-256 of every
imported file. The Markdown snapshots and nine original SVG figures are kept
locally; no assets or article text are fetched by a visitor's browser.
`tools/research.py` generates the research HTML pages using Python's standard library.

To update, review the research repository and choose a full, immutable commit:

```sh
python3 tools/research.py --update FULL_RESEARCH_COMMIT_SHA
python3 tools/research.py --check
python3 tools/check_site.py
```

Review the generated content and check desktop/mobile layouts before publishing.
Running `python3 tools/research.py` without flags regenerates offline; `--check`
verifies source hashes and exact generated HTML without network access or writes.
CI runs that check before validating and deploying `site/`. Edit the original
guide in the research repository, then import its new commit here; do not edit
the generated pages independently. The renderer deliberately rejects unsupported
Markdown blocks and requires review if the study index changes shape.

### Browser inference prototype

`/lab/inference/` compares two unchanged Maia-3 ONNX exports:

- **5M is the default:** 21,346,652 bytes, SHA-256
  `ddae2aa893b5ca7ec94d24178871f1c337d09fd72ff38abe8d76b8ecf08cb942`.
  This is the historical research export, fetched directly from the original
  immutable Git blob. First download including runtime is about 36 MB for CPU
  or 50 MB for WebGPU.
- **79M is optional:** the current Android export, 316,034,244 bytes, SHA-256
  `3454b03ae78baa64a87b345fdb1a457265d912caec531039b074f07eda0d8010`.
  It is fetched from pinned Git LFS media; first download is about 331/345 MB.

No model weights are checked into or served from this website repository.
The model selector updates the first-download estimate without downloading
weights. Downloads begin on Start. Cache keys use each immutable URL, so models
stay separate and a saved runtime can be reused across models. Reports and JSON
filenames identify the model; switching selections does not relabel an existing
result. 5M and 79M predictions differ; this is not a quality-equivalence claim.

The dedicated module worker downloads and verifies the chosen model and pinned
ONNX Runtime Web 1.31.1 backend-specific WebAssembly binary from jsDelivr.
Responses are checked against fixed sizes and SHA-256. Runtime JavaScript and
MIT/third-party notices are vendored locally, with hashes and upstream provenance
in `site/lab/inference/config.json`. Each model has a separate, hash-checked
reference file; 79M retains its original published goldens. The 5M goldens were
computed independently with native ONNX Runtime 1.24.3 and a NumPy encoder, also
checking value logits and selected policy logits. See
[5M validation and reproduction](docs/browser-inference-5m-2026-10-27.md).

A named Cache Storage cache can retain downloads on explicit user choice.
Clear saved downloads deletes only that cache. No result or input is uploaded;
JSON export is a local download. No PWA service worker is installed.

CPU uses one WASM thread for the GitHub Pages environment without COOP/COEP.
GPU is an explicit WebGPU-preferred path; unsupported nodes can execute on CPU,
and per-node placement is not asserted. Eight published native-reference cases
validate orientation, ratings and history on/off before timed runs. Tests use
batch 1 and request all model outputs. Cold session creation and first inference
are separate from warm median/p95; warm timings include encoding and output
readback. This does not measure full native/GPU memory, battery, installation,
background behavior or phone performance by emulating a narrow viewport.

Run `node tools/test_inference.mjs` (Node 22 or newer) for offline encoding,
score/statistics and runtime integrity checks. Full execution needs a real
supported browser and the large downloads. Stop/Clear and both backends must be
checked before changing this experiment. Model/runtime changes need fresh
reference validation; never swap a smaller/re-exported model silently.

### Playable browser preview

`/play/` is the browser trial before Android installation. Desktop shows the app
inside a phone frame; phones use the full viewport. Home, Game, Analysis Board
and Settings keep one shared 5M CPU session. The app and Lichess are the UI/chess
references; both browser boards now use unmodified **Lichess Chessground 10.5.0**
with Brown/Cburnett styling, drag/tap moves, animation, destination dots, capture
rings, check/last-move highlights, and a keyboard adapter. Play supports
White/Black/Random, any whole-number rating from 600–2600 (default 1500), one
legal-checked premove, promotion, takeback, board flip, position navigation,
Analyse game and PGN export. Navigation and takebacks clear premoves.

**Analysis Board** supports legal moves for either side, PGN/file or FEN import,
mainline/variation navigation, branch-preserving PGN export, board flip, current
FEN copy and Continue from here with full FEN state. Trying alternatives keeps
existing moves. Maia displays raw probabilities normalized over all legal moves
(the top five are shown), using the app's mapping and tie order, independently
of play sampling. Local **Stockfish 19 Lite single-threaded** provides two PVs,
White-perspective centipawn/mate scores and blue arrows; Maia's arrow is green.
Searches stop at depth 12 or 600 ms, debounce position changes, and discard stale
results. Engines pause when leaving analysis; the original game is retained.
One Maia worker is shared between play and analysis. Returning to Game resumes
a pending reply. Pause engines, Retry and Stop engine are available.

Stockfish downloads 1,845,971 bytes from pinned unpkg and verifies size/SHA-256
before starting the unmodified local worker glue. The version, source, licence
and hashes are in `site/play/stockfish.json` and `assets.json`. The lite network
and search budget differ from Android's full engine; no equal-strength or full
feature-parity claim is made. The board/piece/rules sources are in
[ASSETS.md](ASSETS.md). Imported PGNs/positions stay local; no automatic uploads.
Game and study remain in this tab's memory, so export PGN before leaving.

Maia startup still overlaps verified model/runtime downloads, reuses the lab's
named cache, skips synthetic/reference warm-ups and reuses one CPU session.
5M remains default; optional 79M play, saved-game recovery, clocks, stacked
premoves, piece editor, second Maia analysis, game-review classifications and
PWA installation remain future increments. The current play sampler remains
Temperature 1 / Top-P 1 with history off; only the new-game rating default and
range were aligned here. See the [roadmap](docs/browser-app-roadmap.md) and
[implementation decision and verification](docs/browser-analysis-2026-10-27.md).

`node tools/test_play.mjs` checks rules/policy/PGN and vendored integrity;
`node tools/test_study.mjs` checks variation import/export, notes/NAGs, custom FEN,
legal policy probabilities and stale/cancelled UCI searches. The optional
`tools/compare_play_startup.mjs MODEL WASM [LEVEL]` retains the independent
native-reference startup comparison; it downloads nothing. No Android source,
release gates or shared Stable/Preview build helpers change in this increment.

### App and screenshot sources

App claims and links were checked against Stable source commit
`cd2551f70f9dde903d4bf543c7ea309beecee58f` and the published Stable `v2.4.0`
release on 2026-10-24 (Asia/Tokyo). See [asset provenance](ASSETS.md).
Screenshots illustrate several released versions; they are not new captures
or release verification. Stable and Preview remain separate.

Download links point to official distribution pages, not hardcoded APK versions.
Keep the homepage concise; detailed features and current release notes live in
the application repositories. The [Mobile Maia community on Flotilla](https://app.flotilla.social/join?r=mobilemaia.spaces.flotilla.social&c=slusagresp6) is a
10-member pilot for questions, game discussions and Preview testing. Its join
link is published in the homepage community section and footer; update both
if the invite is rotated. GitHub issues remain the place for tracked bugs
and feature requests.

## Licence

Original website code: [AGPL-3.0-only](LICENSE), copyright 2026 Mobile Maia
contributors. Reused app assets retain existing rights and applicable upstream
licences. See [ASSETS.md](ASSETS.md), [app component notices](APP_NOTICES.md), and
the website's [privacy and credits page](site/about.html).
