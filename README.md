# mobilemaia.org

The public website for [Mobile Maia](https://github.com/Dash1971/maia-chess-android),
an independent, free and open-source Android chess app built around Maia-3.

The homepage and research use plain HTML/CSS with no build framework, analytics,
cookies or remote fonts. The playable browser edition compiles the actual Flutter
app from pinned source with browser engine/storage adapters. Pages deploys the
static site plus the generated app bundle; APKs and model weights are never
committed or bundled. Local browser storage is described below.

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
Pushes to `main` validate the site, build the pinned browser app, and deploy
`.scratch/browser-build/deploy` through GitHub Actions. Pull requests validate without deploying. In repository
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

### Playable browser edition

Maintainers: [Web adaptation register and source-upgrade checklist](docs/WEB_ADAPTATIONS.md)
records every intentional browser difference and what must be reviewed when
bringing new app features/UI across. Update it alongside adapter/source changes.

`/play/` runs the actual Stable 2.5.0 Flutter application from source
`aeea49817c34f48397e910894414c1d8b0352124`. Desktop presents it inside a phone;
narrow screens fill the viewport. The app's board, drag/tap interactions, legal
moves, highlights, premoves, clocks, settings, analysis engine rows, PGN/FEN/editor,
Recent games and game review use canonical widgets and Dart logic. Browser
adapters replace native inference, Stockfish, storage, files, sound and wake lock.
Electronic-board controls are excluded. This replaces the separate JavaScript UI.

Maia uses the pinned 5M model on one CPU WASM thread. Its unchanged Dart encoder,
sampler and analysis logic consume full raw policy/value outputs from ONNX Runtime
Web. Stockfish 19 Lite runs in a local single-threaded UCI worker under the app's
own analysis scheduler. Smaller model/engine results can differ from Android.
`?model=79m` selects the existing full-model download experimentally; a model
selection/download UI and reliable physical-phone 79M support remain future work.

Games and app data persist in IndexedDB; settings use localStorage. Verified
model/runtime downloads can be saved in the inference lab's named cache. Nothing
is uploaded. The shell requires a modern browser with WasmGC because dartchess
uses 64-bit bitboards; unsupported browsers receive a compatibility message.
Installation is available through Settings → Install and offline (or the browser's
Install/Add to Home Screen command). Settings → Save for offline use saves the
app plus selected Maia, CPU runtime and Stockfish; with 5M, the initial offline
package totals about 64 MB. Wait for Ready for offline play and analysis before
disconnecting. Full offline saving is opt-in so an ordinary first visit does not
compete with Maia's download. Cached files can be evicted by the browser.

A custom, hash-checked `/play/` service worker controls only app clients. Existing
games remain on their running version; updates activate after all Mobile Maia
windows/tabs close. Engine files are cached independently, so an app update does
not deliberately discard model downloads. Installation does not give the browser
native inference speed. Start game now begins Maia preparation before the first
prediction. The native System default theme follows browser/OS light/dark;
wallpaper-derived Android system colors are unavailable through browser APIs.

Build using the official Flutter SDK revision pinned in the build helper:

```sh
python3 tools/build_browser_app.py --source /path/to/maia-chess-android \
  --flutter /path/to/flutter --scratch .scratch/browser-build
python3 -m http.server 8080 --bind 127.0.0.1 --directory .scratch/browser-build/deploy
```

The source checkout must contain the pinned app commit. The helper enforces the
app's disk preflight, exports only source/assets without the 79M model, applies
guarded platform changes, and hashes canonical UI/logic files to reject changes.
Every compiled asset uses a content-addressed bundle path to prevent mixed old
fonts/code after deployment. Flutter service-worker generation is disabled; the build generates our scoped
service worker and its exact asset hashes instead.

Run `node --experimental-vm-modules tools/test_browser_runtime.mjs` for the raw
inference boundary, queue/error/disposal checks and pinned Stockfish integrity;
`node tools/test_inference.mjs` checks the shared encoder/reference/runtime pins.
`node --experimental-vm-modules tools/test_pwa.mjs` checks install opt-in,
offline routing, integrity failures/retry, update safety and cache isolation.
See [implementation and verification](docs/browser-native-2026-10-27.md) and
[remaining work](docs/browser-app-roadmap.md). No Android checkout, release gate,
or shared Stable/Preview build helper changes; no companion app port applies.

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
