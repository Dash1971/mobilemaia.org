# Browser gameplay and Analysis Board

The product reference is Mobile Maia Stable 2.5.0, commit
`aeea49817c34f48397e910894414c1d8b0352124`, and Lichess's website. The user
clarified that interactions should match those references as closely as
practical. This increment uses the actual Lichess JavaScript Chessground for
both boards. It does not introduce a separate style of legal-move feedback.

## Implementation decision

Keep the existing buildless browser entry point for this increment; split board,
study tree, analysis UI and UCI client into modules, with one shared Maia worker.
Use unmodified `@lichess-org/chessground@10.5.0` for drag/tap, dots/capture rings,
selection/check/last-move/premove highlights, animations, drawing and gestures.
Retain Brown/Cburnett presentation and add an accessible keyboard-square layer.
Chess.js remains the legal-move authority, including promotions and castling;
king-to-rook gestures normalize to standard king destinations. Premoves are
validated against the actual position and invalidated by navigation/takeback.
Premove promotions choose a queen, matching the app's normalization.

Flutter reuse was assessed against `lib/main.dart`, `lib/src/play.dart`,
`lib/src/analysis_board.dart`, `lib/src/session_model.dart`,
`lib/src/variation_tree.dart`, `lib/src/maia.dart`, `lib/src/premoves.dart`,
`lib/src/stockfish.dart`, and the vendored Flutter Chessground package. The app
imports `dart:io`, uses a native Maia MethodChannel, Dart isolates, native
multistockfish and Dart `part` files tied to the main library. These need adapters
and source separation before a Flutter web entry point can reuse the complete
screens. No Flutter web build was attempted and no impossibility is claimed.
For this bounded port, reuse the upstream browser board and explicitly port/test
the app's policy and PGN/FEN behavior; revisit Flutter source sharing before the
larger Game Review and persistent-data work. This is a scoped implementation
choice, not a commitment to duplicate every app screen independently.

## Behavior and limits

- Play: White/Black/Random, rating 600–2600 with new-game default 1500; drag/tap,
  keyboard, promotions, one premove, takeback, flip, position navigation, PGN
  export and Analyse game. Historical viewing cannot change the live game.
- Board settings: coordinates, legal destinations, last-move highlight and
  animation for both boards, stored for this tab. Reduced-motion preference
  disables animation. Check highlights remain visible independently.
- Analysis: legal exploration for both sides, complete starting FEN, PGN/file
  import up to 2 MB, nested branches and comments/NAGs, position navigation,
  current FEN copy, branch-preserving PGN export and Continue from here.
  Imported branches are validated rather than discarded. Invalid imports keep
  the current study. Limits: 4,000 positions, 512 plies per line, 64 RAV levels.
- Maia: original pinned 5M CPU, equal Self/Opponent rating, history off. The
  analysis policy ports `MaiaEncoding.legalMoveProbabilities`: stable softmax
  over all legal moves and UCI tie order, with no Temperature/Top-P transformation.
  Show the top five, SAN/probability and green top-move arrow. It does not claim
  a Stockfish evaluation or calibrated playing strength. Maia expected-score
  display and the second rating comparison remain future work.
- Stockfish: `stockfish@19.0.1`, Lite single-threaded NNUE, Hash 16 MB, MultiPV 2,
  `go depth 12 movetime 600`. White-perspective centipawn/mate scores, PVs and blue
  arrow. This is not Android's full Stockfish/network/search behavior. The engine
  glue is unmodified; WASM is size/SHA-256 checked before a Blob URL is passed to
  upstream's hash loader (checked in the pinned source). No isolation headers or unsafe flags needed.
- Both engines run locally, debounce analysis changes and reject obsolete
  positions. The UCI client waits for the old `bestmove` after `stop` before
  starting the next search. Leaving analysis pauses searches; an unfinished game
  and the same Maia session survive. Stop terminates both workers.
- No automatic uploads/accounts/tracking. Maia downloads use GitHub/jsDelivr;
  Stockfish uses pinned unpkg. Saving downloads is optional and uses the named
  benchmark cache. Imports stay local; clipboard access occurs only on Copy FEN.
- Games/studies remain in tab memory: export before leaving. Full 79M play,
  clocks, stacked premoves, board/piece catalog, editor, sampling controls,
  history input, persisted recovery, full Game Review and PWA installation remain
  later increments. Play sampling remains Temperature 1 / Top-P 1; only rating
  defaults/range were aligned here. Electronic-board support stays excluded.

## Provenance and checks

`site/play/assets.json` records npm integrity, corresponding source commits,
licences and every vendored file hash. `stockfish.json` pins the 1,845,971-byte
WASM and SHA-256. It is not checked into Git. Public credits link both GPL
licences and the exact source tags. The existing 5M model/runtime pins are
unchanged. No app repository or shared build helper changed; no Stable/Preview
companion port or app promotion applies. The website CI alone gains its study
regression command.

Run `python3 tools/research.py --check`, `python3 tools/check_site.py`,
`node tools/test_inference.mjs`, `node tools/test_play.mjs`, and
`node tools/test_study.mjs`. Study checks include nested PGN round trips,
comments/starting comments/NAGs, preserved original lines, invalid branches,
castling/en passant/underpromotion, custom-position continuation, legal policy
normalization/orientation and UCI cancellation/stale results. Browser checks
exercise the real workers and actual input, rather than injected fake replies.

Local desktop Chrome checks passed with real 5M/WASM and Stockfish workers:
legal/illegal drags, destination dots and an occupied capture ring; a queued
Black `e7e5` premove during Maia loading executed only after Maia's `d4`, with
the resulting legal line `1. d4 e5 2. dxe5`; keyboard moves/Escape, game position
navigation, custom-FEN continuation/en passant, king-to-rook castling,
promotion cancellation and knight underpromotion; nested PGN import, invalid
FEN recovery, alternative-line preservation, rapid position changes and engine
pause/resume; board settings, flipped player labels/orientation, and returning
to the original game. One Maia session survived game/analysis/settings switches.
No console errors/warnings were reported in that check.

The selected-position snapshot in `browser-analysis-2026-10-27/local-policy.json`
contains the actual five Maia and two Stockfish moves. An independent Chess.js
check confirmed that every displayed move was legal for its recorded FEN.
390×844 and 320×740 viewport checks found no horizontal overflow; the narrow
game board was 300 px at a 320 px viewport. These are resized desktop checks,
not physical-phone/touch acceptance. First Maia startup in the final local
session was 10.75 s, without persistent download saving; that is an observation,
not a controlled performance comparison.

Disk budget: Mac volume had 46,843,498,496 bytes available before downloads;
expected growth below 1 GiB with a 10 GiB reserve. No app builds/emulators were
created. Task-owned bulk is confined to `.scratch/browser-analysis/` (this chat,
retention only through public verification in this turn). Shared tools/caches,
other checkouts and original user benchmark files are not disposable output.

## Published verification and cleanup

Published source `e217a925f7b25412a26497874932c3c8cacf51da` passed
[check and deploy](https://github.com/Dash1971/mobilemaia.org/actions/runs/40480580924).
All 11 entry/module/worker/manifest downloads returned HTTP 200 and matched
local source bytes; hashes are in `browser-analysis-2026-10-27/public-files.json`.
Public drag `e2e4` received the real Maia reply `b6`; Analyse game produced five
Maia choices and two Stockfish PVs. An independent rules check validated all
seven displayed moves against the saved FEN in `public-policy.json`. PGN import
kept nested branches; the current move scrolled into the move-tree viewport.
The 390 px public layout had no horizontal overflow. Returning from analysis
preserved `1. e4 b6` and the same one Maia session/game. Public cold startup was
11.25 s on this desktop; no physical-phone performance claim is made. No console
errors/warnings were reported in this check.

Both local and public workers were stopped, the preview server stopped, test
tabs closed and the temporary viewport reset. Removed the task-owned scratch
directory (96 files, 2,470,155 bytes), including the temporary WASM, npm package
archive/extraction and rewrite script, immediately after public verification.
No bulk was retained. Compact policy/source-hash evidence and the detailed
`browser-analysis-2026-10-27/cleanup.json` remain. QA disabled persistent engine
download saving; existing user cache entries and original phone reports were
left in place. Volume-wide free-space changes include other work and are not
attributed to this task.
