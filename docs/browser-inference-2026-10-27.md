# Browser inference prototype — 2026-10-27

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
Task-owned `.scratch/pwa-benchmark/` holds the verified npm archive and temporary
runtime assets, retained only until public deployment verification, expiring at
task completion. Browser test downloads are in the named prototype cache on
localhost, to be cleared after verification. Compact reports above are retained.
