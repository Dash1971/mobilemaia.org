# Canonical Mobile Maia browser edition — 27 October 2026

## Requirement and implementation

The browser trial must be Mobile Maia, using its existing screens, controls,
English strings, board interaction and analysis presentation. The earlier
independent JavaScript implementation did not satisfy that requirement and is
removed. The app is now compiled from published Stable 2.5.0 source
`aeea49817c34f48397e910894414c1d8b0352124`, using Flutter 3.47.8 revision
`737ba8f885dc774b53b442759999a312c9461e4e`.

`tools/prepare_browser_app.py` exports canonical source read-only and applies
exact, guarded platform-boundary substitutions. Of 54 original Dart files, 44
remain byte-identical. The unchanged analysis board, board editor/preferences/
styles, review, settings widgets, Maia encoder/sampler/settings and all translated
Dart files have SHA-256 assertions. The ten changed files connect browser engine,
I/O, preferences, diagnostics and review scheduling; hide eboard controls; label
the selected browser model correctly; and retain Android Material presentation.
No native app checkout, release gate, version, identity or shared build helper is
changed. Thus no Stable/Preview companion port or app publication applies.

DartWasm is required because dartchess uses exact 64-bit bitboards. The JavaScript
fallback displays a compatibility notice. Flutter single-threaded SkWasm and ONNX
CPU WASM run without COOP/COEP. All Flutter renderers/fonts and app assets are
served locally. Immutable bundle paths prevent cached subset fonts/old code from
mixing with new releases; icon tree shaking is disabled because the JS fallback
would otherwise remove icons used only by the Wasm app. No service worker is
installed. The website/research remain buildless HTML.

## Browser boundaries

- Maia's Dart encoder, policy mapping, legal filtering, sampler, history/settings
  and game logic stay in the app. A worker runs the existing pinned 5M ONNX model
  with ORT Web 1.31.1 CPU, returning all 4,352 policy and three value logits.
  Requests are serialized and rejected on invalid/nonfinite outputs.
- The unchanged app Stockfish analyzer controls a pinned Stockfish 19 Lite UCI
  worker. Native analysis/review budgets, queueing and MultiPV presentation are
  retained. The smaller network differs from Android, as does Maia 5M versus79M;
  neither equal strength nor calibrated result equivalence is claimed.
- The file adapter preserves app repository formats in an in-memory mirror with
  queued, awaited IndexedDB writes. Preferences use a dedicated prefix. Session
  checkpoints and Recent games survive reload; PGN/FEN/file/clipboard and sampling
  exports use browser APIs. Browser storage may be evicted; export important games.
- Review classification executes the existing Dart classifier asynchronously on
  the browser thread because Dart isolates are unavailable. Physical-phone latency
  and long-game responsiveness still need measurement.
- `?model=79m` selects the existing full-model path experimentally; no full-model
  selection/progress UI or physical-phone 79M reliability is claimed. The default
  remains 5M CPU. PWA installation/offline shell remains future work.

## Verification

Local Chrome with isolated QA preferences/IndexedDB, saving engine downloads off:

- Actual Home, Game, Settings, Analysis Board, Recent games and review screens.
- Desktop phone frame; fresh 390×844 launch; real e2–e4 drag followed by 5M e5.
  Last-move highlighting aligns with squares on the native Flutter board.
- Analysis shows real Stockfish SF1/SF2 and M1500 probabilities for e4/e5:
  Nf3 47%, Bc4 21%, Nc3 12%, Other20%. Optional second Maia setting produced
  M1500/M2600 rows with separate predictions in initial-position analysis.
- Reload recovered the game; Home/Recent games resumed it. Game Review completed
  the three-position e4/e5 game with an evaluation graph, classification table
  and White98.2%/Black100.0% accuracy. These are functionality observations,
  not phone performance or model-calibration evidence.
- A fresh preparation matched every Dart file in the successfully compiled local
  project. Offline runtime tests verify raw outputs, queue/error cleanup and
  pinned UCI assets; existing site/research/inference checks remain required.

Live deployment and cleanup evidence is recorded after public verification.
Temporary viewport changes can invalidate the existing renderer surface during
emulation; fresh launches at the target viewport were checked. Physical phones
remain necessary for touch, memory, audio, background lifecycle and startup tests.
