# WebKit JavaScript Maia initialization repair, 2026-10-29

The user reported iOS 16.7.16 Maia backend allocation failures, then a long
“Initializing Maia…” stall and eventual browser crash after the shared-memory
ceiling was reduced. That ceiling alone did not fix the phone. Desktop success
does not establish this device's memory behavior; an OS-killed browser cannot
finish a watchdog or export diagnostics.

## Strict isolation

Android app repositories are read-only. The pinned source checkout remains
clean at `aeea49817c34f48397e910894414c1d8b0352124`. Browser transformations
are confined to this website and disposable web-build copies. No Android code,
shared native build helpers, release gate, version, APK or publication changes.
There is no Stable/Preview companion PR: these are website-only adapters.

`platform-entry.mjs` selects compatibility only when the actual app reports
`dart2js/CanvasKit` and the browser uses WebKit, explicitly excluding Android
and Chromium. Flutter Wasm, Android, Chrome and Firefox keep the standard path.
The existing standard platform body, Maia worker and 256 MiB loader have hash
guards. The standard platform module only exports its unchanged Stockfish
download helper for reuse; inference, storage, UI and engine scheduling stay
as before. Routing tests verify that standard clients never import the
compatibility module.

The compiled JavaScript app is byte-identical to the current public app.
The rebuilt Dart Wasm has the same size/import set but differs in import-string
interning order; it is not claimed byte-identical. The canonical source/compiler
pins and protected UI/domain hashes are unchanged. A real local Flutter Wasm
analysis returned both Stockfish lines and Maia probabilities with the existing
runtime. See [isolation evidence](maia-webkit-2026-10-29/isolation.json),
[visible diagnostics](maia-webkit-2026-10-29/standard-local-ax.txt) and
[analysis screenshot](maia-webkit-2026-10-29/standard-local.png).

## Compatibility path

The separate 5M CPU package uses the same pinned ORT 1.31.1 source, model bytes,
input tensors and output heads. Its build removes Wasm threads/shared memory,
limits operators to the exact model's ONNX operator set and sets a 256 MiB
maximum in the actual Wasm binary and generated loader. This reduces runtime
code and avoids shared-memory machinery. It does not change the Flutter UI,
quantize the model or claim native-phone performance.

The website-only build recipe pins ORT source, Emscripten, build dependencies,
operator config and flags. Generated binaries are distributed as hash-pinned
website runtime release assets and copied into the Pages deployment by
`prepare_maia_cpu.py`; binaries are never committed to Git. The generated
`/play/maia-cpu.json` identifies this profile. Its loader/config/licenses join
the offline shell; verified Wasm bytes join the independent engine cache.

The non-threaded build still inherited an unused `SharedArrayBuffer` declaration
from upstream `pre.js`, allocating zero-page shared memory when that global was
hidden. The guarded `finalize_maia_cpu.py` removes that sole dead declaration,
only when no other reference exists. Its exact original loader hash and processor
hash are retained in the package manifest. The Wasm binary is unchanged by this
postprocessing. The regression test hides the global and rejects **every** shared
`WebAssembly.Memory` construction, including a zero-page probe.

The main-thread `MaiaClient` owns the compatibility worker. Releasing it rejects
both initial preparation and pending predictions, rather than leaving a future
unresolved. Messages/config completions from a terminated attempt cannot affect
a new attempt. Startup, download idle/total, session creation and inference have
deadlines independent of the worker's event loop. Heartbeats do not extend work
deadlines; only actual byte progress extends download idle time. A failure
cooldown prevents repeated immediate initialization attempts.

Diagnostics snapshot main-thread stages/timestamps/trace and bounded failures
without asking the worker to respond. PWA status has a 1.5-second deadline so
it cannot indefinitely block that export. Canonical native lifecycle/queue
implementation and all standard-path behavior remain unchanged.

## Verification contract

`test_maia_client.mjs` covers cancellation during config/init/predict, stale
events, a ready/release/reprepare race, download idle/total limits, heartbeats,
blocked sessions/inference and retry cooldown. `test_runtime_routing.mjs` guards
standard source hashes and checks dispatch for real compiler/UA combinations.
Both standard and compatibility worker tests retain the raw tensor/output/
rating/disposal/error contract; normal inference/chess/site/research/PWA gates
remain required.

Every app build also runs the existing standard memory/parity checks and a
separate real-model compatibility comparison. The latter inspects imported
and defined Wasm memory types, rejects shared memory and verifies the binary
maximum, runs all eight native-reference positions twice, and compares every
policy/value output with the original runtime within existing reference
tolerances. This is desktop/runtime verification, not physical iOS acceptance.

The [Linux source build](https://github.com/Dash1971/mobilemaia.org/actions/runs/40724637526)
completed and cleaned its owned intermediates. The derived runtime binary is
4,595,085 bytes versus the original 14,848,852 (about 69% smaller). Its actual
memory type is unshared, initial 256 pages, maximum 4,096 pages. Observed linear
memory after 16 Node inferences was 73,400,320 bytes (70 MiB); this excludes
browser/app/process memory. Maximum full-output differences from upstream were
0.00001908 policy, 0.000001312 value and 0.000000411 white score, within the
existing tolerances. See [comparison](maia-webkit-2026-10-29/cpu-comparison.json)
and [package manifest](maia-webkit-2026-10-29/runtime-manifest.json).

Real browser worker smoke tests passed the native reference in both Chrome and
desktop Safari 26.6.2 with this exact package. Separate blocked-worker tests in
both browsers stopped a synchronous infinite worker loop from the main thread
and retained the failed stage. See [Chrome inference](maia-webkit-2026-10-29/chrome-reference.txt),
[Safari inference](maia-webkit-2026-10-29/safari-reference.txt),
[Chrome watchdog](maia-webkit-2026-10-29/blocked-worker.txt),
[Safari watchdog](maia-webkit-2026-10-29/safari-watchdog.txt) and the
[temporary local probe source](maia-webkit-2026-10-29/probe.html).
The probe is not deployed product UI. These are modern desktop checks; the
reported physical iOS 16 device remains the final acceptance check.

The actual Safari Flutter analysis board returned Maia probabilities and both
Stockfish lines. Save for offline use completed; after the localhost server was
stopped, a cold reload booted the JavaScript app and produced fresh analysis from
both cached engines. This changes no system network settings and is not a phone
airplane-mode test. See [app analysis](maia-webkit-2026-10-29/safari-app-analysis.txt),
[offline ready](maia-webkit-2026-10-29/safari-offline-saved.txt) and
[cold offline analysis](maia-webkit-2026-10-29/safari-offline-analysis.txt).
Safari's grouped game-setup accessibility controls did not activate Start game
in this automation run; a first game move on this compatibility profile is not
claimed verified. The compiled game UI/logic is unchanged. Physical iOS gameplay,
background recovery and long sessions remain acceptance checks.

The [website runtime release](https://github.com/Dash1971/mobilemaia.org/releases/tag/web-maia-cpu-1.31.1-r1)
was downloaded independently and all six file hashes/lengths matched the pin,
including the finalized loader and full provenance manifest. The temporary CI
package is redundant once this durable, verified release exists.
