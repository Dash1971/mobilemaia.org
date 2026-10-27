# Playable 5M CPU preview — 2026-10-27

Route: <https://mobilemaia.org/play/>. A small turn-based browser game, using the
same unchanged 5M model and single-thread CPU runtime as the benchmark. Android
Stable and Preview source, versions, build tooling and release gates are untouched;
no companion app port or app publication applies to this website-only feature.

## Behavior and sources

- Play White or Black, choose a model rating, tap pieces/destinations, or use
  arrow keys and Enter. The board rotates for Black and moves keyboard focus
  into the board on Start. Legal destinations, last moves and check are shown.
- Legal rules, castling, en passant, promotions, checkmate and automatic draws
  use chess.js 1.4.0, vendored unchanged from its SHA-512-verified official npm
  package. Source and BSD-2-Clause licence are pinned in `site/play/assets.json`.
- Cburnett pieces by Colin M. L. Burnett are unchanged SVGs from Lichess lila
  commit `eaaee2ac2ff62a6c600ed65c60bb01410631e6aa`, GPL-2.0-or-later. Individual
  hashes, original attribution and full licence text are included locally.
- Takeback removes the human move and any completed reply. Revision IDs and FEN
  matching discard late replies after undo/new game. A latest-job worker queue
  avoids concurrent session runs and unbounded queued positions.
- PGN and startup-report exports are local downloads. The current game lives
  only in tab memory. No clock, account, analytics, automatic upload, Stockfish,
  service worker, installation prompt or guaranteed offline shell was added.
- Exact model SHA-256:
  `ddae2aa893b5ca7ec94d24178871f1c337d09fd72ff38abe8d76b8ecf08cb942`.
  Runtime remains ONNX Runtime Web 1.31.1, standard CPU WASM binary, one thread.
  Both pins come from the existing inference config. No weights or WASM binary
  are added to the website repository or served by GitHub Pages.
- Current board repeats in all eight input frames. Self/Opponent ratings are
  equal, raw int64 values. Move indices match the Android policy mapping,
  including Black rank mirroring and all four promotion types. Temperature 1 /
  Top-P 1 samples only legal moves. This is not a strength/calibration study.

## Startup work

1. Model and CPU-runtime fetches overlap rather than run sequentially. Both
   still receive size/SHA-256 checks; partial failures retain byte counts,
   response status, source and error details.
2. The benchmark's existing named cache is reused, so already-saved 5M and CPU
   files do not need downloading again. Saving remains a visible choice on Start.
3. There are **zero synthetic/reference warm-up runs** before play. Validation
   of pinned model outputs is a development check; the first real inference
   generates an actual reply. White may play its first move while loading.
4. One worker/session stays in memory across moves and games in the tab. New
   games reuse it; Stop engine or closing the tab releases it. The board updates
   only changed piece images, keeping selection interactions light.
5. Loading failures preserve the board and offer Load Maia. A controlled local
   HTTP 404 test retained `1. e4`, reported the failure and successfully replied
   from the same position after retry. It used a temporary preview-server override,
   without modifying production configuration.

Download savings depend on network conditions. ONNX session creation is still
required once per loaded worker; this work does not establish a reduction in
that step on a phone. A saved-file reload still creates a session, whereas a new
game in the same live tab does not. Browser compilation caches and system load
can also affect timings. The benchmark's full test duration is not app startup:
it includes many reference/timed inferences, which this game does not run.

## Measured local browser smoke checks

Mac Chrome 155 desktop; these are **not phone measurements**.

| Run | Start to engine ready | Session creation | First real inference |
| --- | ---: | ---: | ---: |
| Cold downloads | 10.78 s | 0.56 s | 158 ms |
| Saved downloads, fresh page | 1.31 s | 1.25 s | 110 ms |

The cold model transfer took 10.18 s and runtime transfer 1.08 s, overlapping.
The cached run verified both saved files; no model/runtime network transfers.
A subsequent game with the existing session produced its opening reply in about
59 ms of inference, with the session-creation count still 1 across 2 games.
Different run conditions and first-inference overhead mean these are smoke
observations, not a controlled speedup claim. Session-time variability is visible.

Compact reports:
[cold](browser-play-2026-10-27/local-cold-all.json),
[cached](browser-play-2026-10-27/local-cached-all.json),
[reuse](browser-play-2026-10-27/local-reused-session.json),
[forced failure](browser-play-2026-10-27/local-download-failure.json),
[recovery](browser-play-2026-10-27/local-recovered.json).

An optional Node/WASM tool also compared graph optimization levels against all
eight native 5M references (scores and sampled policy logits). Fresh-process
session times were 439 ms basic, 397 ms all, and 390 ms extended. No useful gain
was demonstrated, so the existing `all` setting was preserved. These are Node
CPU measurements; they cannot be substituted for browser/phone performance.
The earlier sequential-session trial reused a compiled runtime and has order
bias; it is retained but not used to select a setting.
[Fresh-process results](browser-play-2026-10-27/graph-comparison-fresh-node.json),
[sequential trial](browser-play-2026-10-27/graph-comparison-node.json).

## Verification and limits

`node tools/test_play.mjs` passes known opening perft (8,902 nodes at depth 3),
policy orientation/promotion mapping, stable legal-only sampling including
underflow, legal-rule cases, takeback/late-reply guards, game endings, PGN round
trip and all vendored asset hashes. Existing model/research/site checks pass too.
Browser smoke checks played both colors, reused one session, rejected illegal
taps, took back moves, navigated with arrow keys/Enter/Escape, and recovered
from a missing model while preserving the human move. The 390/320px layouts were
visually checked with no horizontal document overflow; viewport QA is not phone
hardware emulation. Promotion/rule edge cases are covered by offline tests.

Real-phone startup, sustained play, battery/memory behavior and browser eviction
still need fresh measurements. The startup report separates download, session
creation, first inference and perceived reply wait, and counts sessions/games.
It does not claim to measure total native memory or energy use.

## Task storage

Starting volume free space: 54,404,976,640 bytes. Expected task growth under 1 GiB
plus a 10 GiB free reserve. Shared tools were reused; no app build, emulator or
native environment was created. Temporary pinned model/WASM copies and a local
failure-test server live only in ignored `.scratch/play-prototype/`, owned by
this task for verification and expiring at task completion. Preview workers,
processes, test download caches and these temporary binaries are removed after
public verification. Compact source/provenance/reports and QA exports are kept.
