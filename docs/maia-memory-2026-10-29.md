# Maia startup memory adaptation, 2026-10-29

An iOS 16.7.16 report confirmed that the JavaScript Flutter app and Stockfish
worked while Maia initialization failed with `no available backend found. ERR:
[wasm] RangeError: Out of memory`. The failure appeared before any successful
Maia inference, in both game and analysis flows. Repeated requests retried the
same failing backend. No device-specific root cause is claimed without a fresh
test on that phone.

## Change

The pinned ONNX Runtime Web 1.31.1 CPU loader constructs shared Wasm memory with
initial 256 pages (16 MiB) and maximum 65,536 pages (4 GiB), even when
`env.wasm.numThreads = 1`. A large shared-memory maximum is a plausible cause of
the old Safari allocation failure. Older WebKit has documented shared-Wasm and
worker memory problems; those reports motivate this adaptation rather than
prove this device's exact cause:
[Emscripten/Safari reproduction](https://github.com/MathisRaibaud/wasm-memory-error-safari-repro),
[WebKit worker memory issue](https://bugs.webkit.org/show_bug.cgi?id=250569).

For the playable **5M** model, `native/ort-5m-256m.mjs` is derived from the exact
pinned loader. Its memory maximum is 4,096 pages (256 MiB), and the C heap-limit
query, over-limit resize guard and growth clamp use the same ceiling. Initial
memory remains 16 MiB. A smaller supplied maximum is compatible with the Wasm
module's imported-memory limit. Runtime kernels and model bytes are unchanged.

The 79M comparison and inference lab keep their original loaders. No GPU switch,
quantization, model conversion, chess/UI replacement or native app change is made.
The worker requests only the policy and value outputs used by the app, leaving
the model's unused ponder output unfetched. Original encoding/sampling stays in
the canonical Dart source.

`tools/prepare_browser_runtime.py` verifies the upstream loader SHA-256
`30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3`
and exact allocation/limit replacement sites. Its `--check` runs in CI and the
build helper. The derived MIT file retains upstream license attribution. Its
bytes join the native runtime content hash, offline shell and source manifest.
This prevents an old HTTP-cached loader from being mixed into the new worker.

Copy diagnostics now includes browser/compiler/build, the selected loader and
memory limit, initialization failure stage/message/limited stack, and the last
five inference timings. Export still works if platform-status collection fails.
Diagnostics are collected locally without starting an engine or uploading data.

## Real inference verification

`tools/test_maia_memory.mjs` runs isolated Node processes using the exact pinned
5M model and CPU Wasm binary. It tests eight native-reference positions twice.
Both original and bounded loaders pass native policy-sample/value/white-score
tolerances. All 16 complete 4,352-logit policy tensors and three-value tensors
are bit-identical between loaders.

The bounded runtime's observed linear-memory size after session creation and
16 inferences is 76,808,192 bytes (73.25 MiB). This is **Wasm linear memory**,
not total browser/process memory, and it is not an iPhone measurement. Growth
beyond the configured maximum is rejected.

An allocation-ceiling simulation rejects shared-memory reservations over
256 MiB. The original loader fails with the same backend/RangeError form; the
bounded loader completes real inference. This demonstrates the intended remedy
under that constraint, not an emulation of iOS memory management. The harness
also hides the SharedArrayBuffer global, exercising the upstream zero-page
constructor fallback used without cross-origin isolation.

See [baseline](maia-memory-2026-10-29/memory-baseline.json),
[bounded inference](maia-memory-2026-10-29/memory-bounded.json),
[rejected original reservation](maia-memory-2026-10-29/memory-reject-upstream.json),
and [complete-output comparison](maia-memory-2026-10-29/memory-comparison.json).
The build helper runs these real-model checks before compiling the Flutter app
and includes their compact result in public source metadata. Model/runtime
downloads stay in task-owned ignored scratch, outside deployed files.

Unit checks cover model-specific loader selection (5M bounded, 79M original),
versioned loader URLs, policy/value fetches, tensor disposal, and initialization/
inference error details. Existing chess, reference, PWA, site and research gates
remain in place. W01/W11 in [WEB_ADAPTATIONS.md](WEB_ADAPTATIONS.md) record the
ongoing upgrade contract.

## Browser checks

The forced JavaScript Flutter app returned real Stockfish lines and Maia 1500
probabilities (e4 64%, d4 24%, c4 3%) with the bounded loader. Visible diagnostics
reported `ort-5m-256m.mjs`, `wasmMemoryMaxMiB: 256` and ready status. After saving
for offline use, stopping the localhost server and cold-reloading, both engines
returned fresh analysis; diagnostics showed the cached verified model/runtime
and the same bounded loader. See [analysis](maia-memory-2026-10-29/local-analysis.png),
[diagnostics](maia-memory-2026-10-29/local-diagnostics.json) and
[offline diagnostics](maia-memory-2026-10-29/local-offline-diagnostics.json).
This does not change the user's network or establish a physical-phone airplane-
mode result. The isolated local test data/engine cache was cleared afterward.

A direct worker smoke test in desktop Safari 26.6.2 also passed using the
actual bounded loader and model. For one native-reference case, policy sample
error was at most 0.00001526 and value error at most 0.000000865, within the
0.002 logit tolerance. See [Safari result](maia-memory-2026-10-29/safari-worker.json)
and the [temporary local probe source](maia-memory-2026-10-29/safari-probe.html).
The probe ran outside the Flutter shell and is not deployed as product UI.
Its owned worker/cache was cleared and its tab closed afterward. This is a
modern desktop WebKit check, not an iOS 16 qualification.

## Scope and remaining acceptance

Physical iOS 16 acceptance is pending. A successful desktop test cannot establish
that phone's memory behavior, long-session lifecycle or background recovery.
After deployment, an old installed service worker must finish its safe update;
close Mobile Maia tabs/windows and reopen before retesting. Clearing saved games
or all browser data is not required by this change.

This is a website-only adapter and verification change. Stable/Preview source,
shared native helpers and APK release gates are unchanged; there is no native
companion PR or app publication to perform.

Build host: macOS, shared pinned Flutter 3.47.8/Dart and shared Pub cache.
Task bulk was `.scratch/maia-memory`, with an explicit owner, expected growth
under 2 GiB and a 10 GiB reserve. Initial free space was about 63.8 GiB.
Compact evidence is retained beside this document. Cleanup completed immediately
after public verification and before this evidence-only follow-up commit.


## Public verification and cleanup

Commit `dbf6612636cea8ff24690ee02a1acb93d486c3ec` passed the full
[CI, real-model memory gate, Flutter build and Pages deployment](https://github.com/Dash1971/mobilemaia.org/actions/runs/40715344867).
The deployed bundle is `4a5d7e4b841e17ad`, native runtime `f338a072af05bcdc`,
offline release `cfecfbd6bb9d532e9b16`. The downloaded derived loader matches
source SHA-256 `01dbec91baae8526e56ae78123b9481178b9d7db73836c90c391eb931967cd9f`.
See [public source metadata](maia-memory-2026-10-29/public-source.json) and
[loader verification](maia-memory-2026-10-29/public-loader.json).

The existing public worker safely prepared the new shell while its old app was
open. Closing the owned test tab activated the update. In the new JavaScript
app, dragging e2-e4 received a real Maia g6 reply. Analysis then returned the
expected Maia probabilities and real Stockfish lines. Visible diagnostics
confirmed the bounded loader, 256 MiB ceiling, successful predictions and
verified unchanged model/runtime hashes. See [game](maia-memory-2026-10-29/public-game.png),
[analysis](maia-memory-2026-10-29/public-analysis.png) and
[diagnostics](maia-memory-2026-10-29/public-diagnostics.json).

The public JavaScript is byte-identical to the locally tested compiled app,
SHA-256 `9b4078f8f445f7509c9b449ca86f7a5e42ee55ec27b133a635b26975bd655110`.
This qualifies the published artifact under the tested desktop conditions;
physical iOS 16 acceptance remains pending.

Local Chrome app, desktop Safari probe and public Chrome QA data/engine caches
were cleared with completion confirmed, and their owned tabs closed. All owned
servers/build/test/watch processes stopped. The checked task-owned scratch root
was removed, including every copied model/runtime binary (550,999,427 file bytes).
Shared tools/caches, ordinary user games/preferences/models and the public PWA
worker/verified shell were retained. See [cleanup](maia-memory-2026-10-29/cleanup.json).
No APK, emulator, signing material or native release was created or changed.
