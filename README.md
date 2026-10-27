# mobilemaia.org

The public website for [Mobile Maia](https://github.com/Dash1971/maia-chess-android),
an independent, free and open-source Android chess app built around Maia-3.

Plain HTML, CSS, and a small progressive-enhancement script. No package manager,
framework, runtime build step, external fonts, analytics or cookies. The homepage
and research articles use no browser storage; the opt-in inference lab is described below.
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

`/lab/inference/` is an opt-in performance experiment using the exact current
316,034,244-byte Maia-3 79M ONNX export, SHA-256
`3454b03ae78baa64a87b345fdb1a457265d912caec531039b074f07eda0d8010`.
No model weights are checked into or served from this website repository.

The dedicated module worker downloads and verifies that model from its pinned
Git LFS media URL and the pinned ONNX Runtime Web 1.31.1 backend-specific WebAssembly binary from
jsDelivr. Both responses are checked against fixed sizes and SHA-256. Runtime
JavaScript and MIT/third-party notices are vendored locally, with hashes and
upstream provenance in `site/lab/inference/config.json`. Visitor downloads happen
only after Start; fixture data is small and local. A named Cache Storage cache
can retain downloads on explicit user choice. Clear saved downloads deletes only
that cache. No result or input is uploaded; JSON export is a local download.

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
