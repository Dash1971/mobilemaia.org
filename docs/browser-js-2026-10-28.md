# JavaScript fallback, 2026-10-28

The browser edition now compiles the same pinned Stable 2.5.0 Flutter app to
JavaScript/CanvasKit as well as DartWasm/SkWasm. The previous JavaScript target
only displayed an unsupported-browser notice. The pinned Flutter loader retains
its default browser gates: Safari/Firefox choose JavaScript automatically;
`/play/?renderer=js` also selects it for repeatable testing on Chromium.
No browser security flags or Wasm allowlist overrides are used.

## Representation boundary

`tools/prepare_browser_chess.py` checks the reviewed dartchess 0.13.1 tree against
SHA-256 `75d3bb8787ed631a69ce4d3ea231241582501f9a74c16dc46e824a3acce490e9`.
After locked Pub resolution, it copies that dependency into disposable scratch
and redirects only this app's package config. Shared Pub cache files stay intact.

The SquareSet facade conditionally exports upstream int64 arithmetic for Wasm
and an unsigned two-limb Dart implementation for JavaScript. The latter preserves
64-bit shifts, modulo subtraction with borrow, mirroring, iteration, equality
and hashing. Constant masks in board/castling constructors are split into exact
32-bit halves at preparation time. Attack generation, legality, positions, PGN,
FEN, app widgets and Maia encoding/sampling remain canonical source.
The deployed source manifest records the dependency/adapter hashes, unchanged
rule-file hashes and actual build's chess verification results.

Both targets share browser storage and CPU engine adapters. Maia/Stockfish still
use ordinary WebAssembly; the fallback removes the Flutter app's WasmGC
requirement. The original Flutter screens, strings and board interactions are
retained. Diagnostics identify the actual compiler used by the running app.

## Validation

Every build runs the same Dart driver against untouched upstream VM chess,
adapted VM chess and optimized dart2js output executed in Node. All three matched:

- 19,008 arithmetic/bitboard checks against BigInt, including limb-boundary
  shifts, subtraction, mirrors, iteration and single-bit/equality behavior.
- 165 positions and 717,822 known perft nodes: starting position at depth four,
  upstream tricky positions, 100 random positions and 50 Chess960 positions.
- 6,042 move checks including deterministic full-game sequences, SAN roundtrips,
  FEN, legal destinations and promotion choices.

See [chess results](browser-js-2026-10-28/chess-verification.json).
The inference/reference tests, runtime-boundary tests, PWA tests, site checks,
research checks and full dual-target Flutter build passed locally.

In an isolated Chrome QA namespace, the forced JavaScript app rendered the actual
Flutter UI. Dragging e2-e4 received a real Maia e5 reply; selecting the knight
displayed the native legal-destination markers. Analysis returned real Stockfish
lines and Maia probabilities (e4 64%, d4 24%, c4 3%). Switching to Wasm and back
retained the same saved game/position. See the [analysis screenshot](browser-js-2026-10-28/local-analysis.png)
and [Wasm diagnostics](browser-js-2026-10-28/local-wasm-diagnostics.json).

Saving for offline use completed. With the task's localhost server stopped,
reloading cold-started JavaScript/CanvasKit; both engines returned fresh analysis.
Diagnostics confirmed the selected compiler, active service worker, offline-ready
state and hash-verified cached Maia/runtime. See [offline diagnostics](browser-js-2026-10-28/local-offline-diagnostics.json)
and [rendered analysis](browser-js-2026-10-28/local-offline-analysis.txt).
Unit tests additionally deny all network requests while fetching both app targets
and renderer assets from the service worker.

The shell includes both builds, full CanvasKit and both SkWasm variants, about
37.7 MB across 859 files; with 5M/CPU/Stockfish, initial offline saving is about
76 MB. The shell budget is 40 MiB. Unused renderer variants/source maps are not
precached. App updates continue to wait for running clients to close.

## Limits and channel scope

These are desktop Chrome correctness/runtime/cache checks. They do not qualify
iOS 16.7.16, physical iPhone installation, airplane mode, memory pressure or
background lifecycle. A subsequent desktop Safari check automatically selected dart2js/CanvasKit,
rendered the actual Flutter app, and returned a real Maia e6 reply to a dragged
e2-e4. See [Safari observations](browser-js-2026-10-28/safari-auto-fallback.txt).
Separate Safari Stockfish/offline checks were not completed. The user's iOS device is still needed for acceptance. No speed improvement over native is promised.

This is a website-only dependency/platform adaptation. Stable and Preview
checkouts, shared native build helpers, APK release gates, versions and app
publication are unchanged; no native companion PR or release applies.
The continuing contract is [WEB_ADAPTATIONS.md](WEB_ADAPTATIONS.md), W09/W12/W14.

Build host: macOS, shared pinned Flutter 3.47.8/Dart SDK and Pub cache. Initial
free space was about 63.8 GiB, with expected growth under 2 GiB and a 10 GiB
reserve. All task bulk was under `.scratch/browser-js`; compact evidence is kept in this
document's sibling directory. Cleanup completed immediately after public
verification, before this evidence-only follow-up commit.


## Public deployment and cleanup

Source `435ac8c882787dbe683c247eea4c0a46b237efb5` passed the full
[GitHub build, tests and Pages deployment](https://github.com/Dash1971/mobilemaia.org/actions/runs/40706380270).
The public bundle is `bf5dc78021e0536b`, offline release `2da62843780cec627bc8`.
The published JavaScript SHA-256 is
`d0b959f77148971f431e7cc43725a9027d15a916741eed6d71f634480baa53d4`,
identical to the clean locally verified build. Public source metadata includes the
passing chess comparison and exact adapter/rule hashes. See [source manifest](browser-js-2026-10-28/public-source.json)
and [downloaded asset hashes](browser-js-2026-10-28/public-assets.json).

An existing public service worker kept the old app running while the new shell
installed. Closing the owned test tab allowed the new worker to activate; a new
tab loaded the new bundle and forwarded `renderer=js`. The deployed JavaScript
app then returned fresh Stockfish lines and the expected Maia probabilities.
Visible diagnostics reported dart2js/CanvasKit, verified 5M/CPU hashes and
an offline-ready shell/engine cache. See [public analysis](browser-js-2026-10-28/public-analysis.png)
and [diagnostics](browser-js-2026-10-28/public-diagnostics.json).

All three QA namespaces (local Chrome, desktop Safari, public Chrome) had their
own games/preferences/model/runtime cache cleared through the test cleanup
control, with completion confirmed before closing their owned tabs. All owned
servers/builds were stopped. The checked task-owned scratch directory was removed
(478,263,043 file bytes); shared tools/caches and normal user app data were retained.
The public service worker/verified app shell remains as the requested offline
feature. See [cleanup report](browser-js-2026-10-28/cleanup.json). No APK, emulator,
virtual environment or filesystem model copy was created.
