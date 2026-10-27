# Browser inference prototype — 2026-10-27

This records the initial 79M-only prototype. The [5M follow-up](browser-inference-5m-2026-10-27.md) adds the smaller default and retains 79M for comparison.

Public route: <https://mobilemaia.org/lab/inference/>. This is a foreground
inference experiment to inform a possible PWA, not an installable app or a
replacement for the Android release. No Stable/Preview code, build helper or
release gate changed, so no companion app port applies.

## Sources and method

- Exact current Android Maia-3 79M export from app commit
  `5f6743eed5491d2e8413fe0dfd1f8ef612d0aa84`: 316,034,244 bytes,
  SHA-256 `3454b03ae78baa64a87b345fdb1a457265d912caec531039b074f07eda0d8010`.
  It is fetched from pinned Git LFS media, never copied into this repository.
- ONNX Runtime Web 1.31.1 from the official npm tarball, verified with the npm
  SHA-512 integrity value. Locally vendored JavaScript/loaders and original
  MIT/third-party notices have individual hashes in `config.json`. Backend
  WASM files are fetched from pinned jsDelivr URLs and size/hash checked.
- CPU uses the standard WASM bundle/loader; WebGPU uses the **Asyncify** pair
  required by this release. Each session requests only its chosen provider.
  An earlier development pairing with the JSEP loader permitted whole-backend
  fallback; that diagnostic result is excluded. WebGPU can still use CPU nodes
  internally; this experiment does not prove per-node GPU placement.
- Encoder follows the pinned app's `MaiaEncoding`: float32 `[1,64,97]`, eight
  historical boards with each board's own side-to-move orientation, zero channel
  96; unnormalized int64 ratings. History-off repeats the current board.
- Eight native reference cases from research commit
  `74d8684db865753080da72c6f43b1973bbfd668e`,
  `studies/score-reliability-2026-10-27/data/known-case-sanity.json`.
  They cover before/after 26.Rd1, ratings 1600/2600, history on/off. Expected
  tensor SHA-256 values were computed independently with Python float32 packing.
  Source JSON hash and a White-score tolerance of 0.0005 are pinned in config.
- Batch 1; all three model outputs computed and read back. Finiteness and policy
  length are checked. White score uses L/D/W softmax and the current side to move.
  Eight reference inferences warm the session before measurement. Timings include
  encoding, tensor construction, inference, readback and result validation, but
  exclude tensor disposal. Session creation and first inference are separate.
- CPU has one WASM thread, with no COOP/COEP on this GitHub Pages host. A module
  worker keeps controls responsive and Stop terminates it. Later visibility
  changes are recorded and a hidden-tab run receives a comparison warning.

## Desktop smoke results

These are **Mac Chrome 155 desktop measurements, not phone measurements**.
Browser reports 10 logical cores and approximate device memory of 16 GiB; these
are capability reports, not measured process memory. GPU preflight adapter reports
Apple / metal-3; per-node placement is not measured. No throttling was applied.

| Backend | Warm runs | Median | p95 | First inference | Session creation | Max White-score error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CPU WASM, 1 thread | 32 | 178.3 ms | 189.7 ms | 211.1 ms | 1,067.4 ms | 7.28e-7 |
| WebGPU requested | 8 | 41.1 ms | 48.4 ms | 764.7 ms | 4,268.3 ms | 4.57e-7 |

Both passed all eight references with the final backend-specific runtimes.
The samples are small, use fixed positions and were taken at different times;
they do not establish a cross-device speedup. Download and verification are
excluded from the startup columns. The model was already in the prototype's
cache; each runtime was downloaded on its respective run.

Compact reports with all timings, source hashes and validation results:
[CPU](browser-inference-2026-10-27/desktop-cpu.json) and
[WebGPU](browser-inference-2026-10-27/desktop-webgpu.json).

Offline checks passed: research source/render integrity, static links/assets,
eight reference tensor hashes, value perspective and stable softmax, timing
statistics, and all vendored file hashes. Desktop and 390/320px layouts were
visually inspected with no horizontal document overflow. Stop during model
verification returned to an idle, explicitly cancelled result. Narrow viewport
QA does not emulate phone hardware.

## Testing a real phone

1. Open the public route in the phone's browser, on Wi-Fi. First download is
   approximately 331 MB for CPU or 345 MB for GPU. Enter device/browser and power
   mode in the optional note, keeping sensitive information out of it.
2. Start with CPU and 32 iterations; keep the tab visible. Save the JSON.
3. Repeat with WebGPU if supported, and save its JSON. A failure result is useful
   too. Switching providers can reuse the model if downloads were saved.
4. Repeat runs to assess variability and sustained performance. Compare fresh
   session creation, first inference, median/p95, verification and reference
   checks separately. Clear saved downloads to test network startup again.

No results are uploaded automatically. Named Cache Storage is opt-in at Start
and the clear button deletes only this experiment's downloads. GitHub and
jsDelivr receive normal download requests; no account, analytics or cookies.

The loader holds the entire model, with temporary hashing/session copies, so
startup peak memory is not optimized. Memory pressure or tab termination on a
phone is evidence to investigate, not proof that every browser implementation
must fail. Safari/iOS, Android browsers, long-run thermal/battery behavior, full
app startup, installability, offline shell and background lifecycle remain
untested. There is no service worker and no PWA installation prompt.

## Task storage

Volume free space at start: about 70 GiB; task budget under 2 GiB plus the 10 GiB
reserve. No app builds, emulator, virtual environment or filesystem model copy.
After public verification, `.scratch/pwa-benchmark/` was removed (64,284,938 bytes).
The preview server was stopped, completed workers terminated and the test tab
closed. The named prototype download cache was cleared through the UI on both
localhost and the public HTTPS origin. Volume free space immediately before/after
scratch removal was 64,017,526,784 / 64,081,809,408 bytes (other workspace tasks
can also change total free space). Compact reports are retained; no task bulk
output remains. [Cleanup evidence](browser-inference-2026-10-27/cleanup.json)
lists the removed paths and intentional retention.

## Public-host verification

Code commit `e8abcf4a37bc74f4d9b1bd4d770c27d783443d74` passed the
[check and Pages deployment](https://github.com/Dash1971/mobilemaia.org/actions/runs/40453036916).
All 13 lab files were fetched over verified HTTPS and matched local bytes;
module MIME is `text/javascript`. COOP/COEP are absent as expected.
[Asset checks](browser-inference-2026-10-27/public-assets.json) preserve hashes
and response metadata.

Both public-host tests passed all eight references. CPU warm median/p95 was
184.1/185.5 ms (8 samples), and WebGPU requested was 43.0/110.6 ms (8 samples).
The GPU p95 outlier and small samples reinforce the need for repeated runs.
Neither run recorded a hidden-tab transition. These remain desktop smoke tests.
Full reports: [CPU](browser-inference-2026-10-27/public-cpu.json),
[WebGPU](browser-inference-2026-10-27/public-webgpu.json).
Chrome's recent-download UI confirmed a prototype WebGPU JSON export as Done
(5.2 KB); the automation download-event hook timed out, so the native UI was
used for confirmation. Stop, cache clearing and desktop/narrow layouts were
also checked.

## Candidate smaller model

The user raised 5M as a better website candidate during this task. The exact
historical research export is **21,346,652 bytes**, SHA-256
`ddae2aa893b5ca7ec94d24178871f1c337d09fd72ff38abe8d76b8ecf08cb942`, versus
316,034,244 bytes for the current Android model. Its existing research archive
was read without materializing or modifying its weights. The archive is
19,416,551 bytes, SHA-256
`aaadbc907664aaccec9c5a1c534b91fbce273ed3fa04df68d692b046c8806110`.
It remains available in the
[immutable source snapshot](https://github.com/Dash1971/maia-chess-android/raw/e5c2392c4d979a47e458ba6f571c72ca60ae817b/docs/research/maia3-sampling/assets/mobile-maia-5m-reproduction-asset.zip),
with attribution, model card, exporter and licence. It is not the current Android
asset. Serving its raw ONNX bytes with these runtimes would imply approximately
36 MB for CPU or 50 MB for GPU before HTTP compression, rather than 331/345 MB.

This prototype retains the originally requested current 79M baseline. Adding a
5M option needs its own pinned download and native reference outputs; the 79M
golden scores cannot validate a different model. Smaller weights are a promising
website default, but this task does not measure 5M browser speed, peak memory,
playing quality or score calibration.
