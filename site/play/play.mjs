// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { Chess, createGame, uci, takeBack, currentReply, ending } from './game.mjs?v=20261027-study1';
import { ChessBoard, pieceNames as names } from './board.mjs?v=20261027-study1';
import { AnalysisView } from './analysis.mjs?v=20261027-study1';
import { CACHE_NAME } from '../lab/inference/core.mjs?v=20261027-5m';
const $ = id => document.getElementById(id);
let game = new Chess(), human = 'w', rating = 1500, started = false, promotionCommit;
let worker, ready = false, loading = false, thinking = false, revision = 0, boot = 0;
let engineStart, diagnostics = {}, lastMoveText = '', engineError = '', sessions = 0, games = 0;
let awaitingSince, pendingFen, viewPly = null, orientation = 'w';
let activeView = 'home', settingsReturn = 'home';
const visibility = [{ at: new Date().toISOString(), state: document.visibilityState }];
document.addEventListener('visibilitychange', () => visibility.push({ at: new Date().toISOString(), state: document.visibilityState }));
const labelColor = color => color === 'w' ? 'White' : 'Black';
const board = new ChessBoard($('board'), moves => {
  const fen = game.fen();
  promote(moves, move => {
    if (game.fen() !== fen || activeView !== 'game' || viewPly !== null || game.turn() !== human || game.isGameOver()) return;
    game.move({ from: move.from, to: move.to, promotion: move.promotion });
    awaitingSince = performance.now(); lastMoveText = ''; revision++; render(); askMaia();
  });
});
board.onPremove = queued => { $('cancel-premove').hidden = !queued; };
$('cancel-premove').addEventListener('click', () => board.cancel());
const analysis = new AnalysisView({
  promote, download, hints: () => $('legal-hints').checked, highlight: () => $('last-highlight').checked,
  coordinates: () => $('board-coordinates').checked, animation: () => $('board-animation').checked,
  keep: () => $('keep').checked,
  requestMaia: job => { if (ready) worker.postMessage(job); else startEngine(); },
  continueFrom: fen => { pendingFen = fen; $('custom-position').hidden = false; showView('home'); }
});
function analysisOwnsEngine() { return activeView === 'analysis' || (activeView === 'settings' && settingsReturn === 'analysis'); }
function syncShell() {
  $('resume').hidden = !started;
  $('app-back').hidden = activeView === 'home'; $('app-footer').hidden = activeView !== 'home';
  $('app-title').textContent = ({ home: 'Mobile Maia', game: 'Play Maia', settings: 'Settings', analysis: 'Analysis Board' })[activeView];
  const status = ready ? '5M CPU · Engine ready' : loading
    ? ($('load-progress').hasAttribute('value') ? 'Loading Maia 5M…' : 'Preparing Maia…')
    : engineError ? 'Maia needs to reload' : diagnostics.startedAt ? 'Maia is stopped' : '5M CPU · Ready to start';
  if ($('session-indicator').textContent !== status) $('session-indicator').textContent = status;
}
function showView(view, focus = true, pgn, facing) {
  if (view === 'game' && !started) view = 'home';
  if (view === 'settings' && activeView !== 'settings') settingsReturn = activeView;
  if (activeView === 'analysis' && view !== 'analysis') analysis.leave();
  if (view === 'analysis') { revision++; thinking = false; }
  board.cancel();
  if ($('promotion').open) $('promotion').close();
  activeView = view;
  for (const name of ['home','game','settings','analysis']) $('view-' + name).hidden = name !== view;
  $('app-content').scrollTop = 0; syncShell();
  if (view === 'analysis') analysis.enter(pgn, facing);
  if (view === 'game') { render(); askMaia(); }
  if (focus) {
    if (view === 'game') board.focus();
    else if (view === 'analysis') analysis.board.focus();
    else (view === 'home' ? $('side') : $('app-back')).focus({ preventScroll: true });
  }
}
$('app-settings').addEventListener('click', () => showView('settings'));
$('home-settings').addEventListener('click', () => showView('settings'));
$('resume').addEventListener('click', () => showView('game'));
$('open-analysis').addEventListener('click', () => showView('analysis'));
$('analyse-game').addEventListener('click', () => showView('analysis', true, game.pgn(), orientation));
$('app-back').addEventListener('click', () => showView(activeView === 'settings' ? settingsReturn : 'home'));
$('reset-position').addEventListener('click', () => { pendingFen = null; $('custom-position').hidden = true; });
for (const id of ['legal-hints','last-highlight','board-coordinates','board-animation']) $(id).addEventListener('change', () => { render(); analysis.renderBoard(); });
function shownGame() {
  if (viewPly === null) return game;
  const history = game.history({ verbose: true }), copy = new Chess(history[0]?.before || game.fen());
  for (const move of history.slice(0,viewPly)) copy.move(move);
  return copy;
}
function render() {
  const history = game.history({ verbose: true }), display = shownGame(), last = display.history({ verbose: true }).at(-1);
  $('keep').disabled = loading;
  board.update({ game: display, orientation, movable: started && viewPly === null && game.turn() === human && !game.isGameOver(),
    premoveColor: started && viewPly === null && !game.isGameOver() ? human : undefined,
    lastMove: last, hints: $('legal-hints').checked, highlight: $('last-highlight').checked,
    coordinates: $('board-coordinates').checked, animation: $('board-animation').checked });
  const topIsHuman = orientation !== human;
  $('opponent').textContent = topIsHuman ? 'You' : `Maia 5M · ${rating}`;
  $('player-bottom').textContent = topIsHuman ? `Maia 5M · ${rating}` : 'You';
  $('human-color').textContent = labelColor(orientation); $('opponent-color').textContent = labelColor(orientation === 'w' ? 'b' : 'w');
  const end = ending(game, human);
  if (viewPly !== null) $('game-status').textContent = `Viewing position ${viewPly} of ${history.length}. Return to the live position to play.`;
  else if (end) $('game-status').textContent = end;
  else if (!started) $('game-status').textContent = 'Choose your side, then start a game.';
  else if (game.turn() === human) $('game-status').textContent = `Your move.${game.isCheck() ? ' You are in check.' : ''}${loading ? ' Maia is loading in the background.' : ''}`;
  else if (engineError) $('game-status').textContent = 'Maia could not continue. Load Maia to retry; your position is kept.';
  else if (!ready) $('game-status').textContent = loading ? 'Maia is loading. Your position is ready and waiting.' : 'Load Maia to continue this game.';
  else $('game-status').textContent = 'Maia is thinking…';
  $('undo').disabled = !history.some(move => move.color === human);
  $('board').setAttribute('aria-busy', String(thinking)); $('pgn').disabled = history.length === 0;
  $('last-move').textContent = lastMoveText;
  $('moves').replaceChildren();
  for (let i = 0; i < history.length; i += 2) {
    const li = document.createElement('li');
    for (let n = i; n < Math.min(i + 2, history.length); n++) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'move-link';
      button.textContent = `${history[n].before.split(' ')[5]}${history[n].color === 'w' ? '.' : '…'} ${history[n].san}`;
      button.setAttribute('aria-current', String(n + 1 === (viewPly ?? history.length)));
      button.addEventListener('click', () => { board.cancel(); viewPly = n + 1 === history.length ? null : n + 1; render(); }); li.append(button);
    }
    $('moves').append(li);
  }
  if (viewPly === null) $('moves').scrollLeft = $('moves').scrollWidth;
  $('moves').hidden = history.length === 0;
  $('empty-moves').hidden = history.length > 0;
  const ply = viewPly ?? history.length;
  $('game-first').disabled = $('game-previous').disabled = ply === 0;
  $('game-last').disabled = $('game-next').disabled = viewPly === null;
  if (end) game.setHeader('Result', game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2');
  else game.setHeader('Result', '*');
  syncShell();
}
for (const action of ['first','previous','next','last']) $('game-' + action).addEventListener('click', () => {
  board.cancel();
  const count = game.history().length, ply = viewPly ?? count;
  const next = ({ first: 0, previous: Math.max(0,ply-1), next: Math.min(count,ply+1), last: count })[action];
  viewPly = next === count ? null : next; render();
});
$('game-flip').addEventListener('click', () => { orientation = orientation === 'w' ? 'b' : 'w'; render(); });
function promote(moves, commit) {
  if (!moves.length) return;
  if (moves.length === 1 || !moves.some(move => move.promotion)) { commit(moves[0]); return; }
  promotionCommit = commit; $('promotion-options').replaceChildren();
  for (const type of ['q','r','b','n']) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', `Promote to ${names[type]}`);
    const image = document.createElement('img'); image.src = `pieces/${moves[0].color}${type.toUpperCase()}.svg`; image.alt = ''; button.append(image);
    button.addEventListener('click', () => {
      const move = moves.find(move => move.promotion === type), finish = promotionCommit;
      promotionCommit = null; $('promotion').close(); if (move) finish?.(move);
    });
    $('promotion-options').append(button);
  }
  $('promotion').showModal(); positionPromotion();
}
function positionPromotion() {
  if (!$('promotion').open) return;
  const phone = document.querySelector('.phone-shell').getBoundingClientRect(), dialog = $('promotion').getBoundingClientRect();
  const x = Math.max(dialog.width / 2 + 8, Math.min(innerWidth - dialog.width / 2 - 8, phone.left + phone.width / 2));
  const y = Math.max(dialog.height / 2 + 8, Math.min(innerHeight - dialog.height / 2 - 8, phone.top + phone.height / 2));
  $('promotion').style.left = `${x}px`; $('promotion').style.top = `${y}px`;
}
window.addEventListener('resize', positionPromotion);
$('promotion-cancel').addEventListener('click', () => $('promotion').close());
$('promotion').addEventListener('close', () => { promotionCommit = null; render(); analysis.renderBoard(); });
function askMaia() {
  if (analysisOwnsEngine() || !started || !ready || thinking || game.turn() === human || game.isGameOver()) return;
  thinking = true; const id = ++revision;
  worker.postMessage({ type: 'move', id, fen: game.fen(), rating, legal: game.moves({ verbose: true }).map(uci) }); render();
}
function updateMetrics() {
  $('diagnostics').disabled = !diagnostics.startedAt;
  const pieces = [];
  if (diagnostics.mainReadyMs != null) pieces.push(`Ready in ${(diagnostics.mainReadyMs / 1000).toFixed(2)} s`);
  if (diagnostics.sessionCreationMs != null) pieces.push(`session creation ${(diagnostics.sessionCreationMs / 1000).toFixed(2)} s`);
  if (diagnostics.firstInferenceMs != null) pieces.push(`first inference ${diagnostics.firstInferenceMs.toFixed(0)} ms`);
  pieces.push(`${sessions} session${sessions === 1 ? '' : 's'} created in this tab`, `${games} game${games === 1 ? '' : 's'} started`);
  $('metrics').textContent = pieces.join(' · ');
  $('startup-json').textContent = JSON.stringify(startupReport(), null, 2);
  syncShell();
}
function startupReport() {
  return { ...diagnostics, sessionsCreated: sessions, gamesStarted: games,
    engineReady: ready, engineLoading: loading, visibilityChanges: visibility, page: location.href,
    device: { userAgent: navigator.userAgent, logicalCores: navigator.hardwareConcurrency, crossOriginIsolated: self.crossOriginIsolated } };
}
function stopEngine(reason = 'Maia is stopped. Load Maia to continue.', all = true) {
  board.cancel();
  if (all) analysis.stop();
  boot++; revision++; worker?.terminate(); worker = null; ready = false; loading = false; thinking = false;
  $('release').disabled = true; $('retry').hidden = !started && !analysis.active; $('load-progress').hidden = true;
  $('engine-title').textContent = 'Engine stopped.'; $('engine-status').textContent = reason;
  render(); updateMetrics();
}
function failed(message, data) {
  if (data) diagnostics = { ...diagnostics, ...data };
  stopEngine(message, false); engineError = message; analysis.maiaError(message);
  diagnostics.error = message; diagnostics.failedAt = new Date().toISOString();
  $('engine-title').textContent = 'A loading problem.'; updateMetrics(); render();
}
async function startEngine() {
  if (ready || loading) return;
  loading = true; engineError = ''; engineStart = performance.now();
  const thisBoot = ++boot;
  diagnostics = { startedAt: new Date().toISOString(), version: '20261027-study1', downloads: [] };
  $('engine-title').textContent = 'Loading Maia.'; $('engine-status').textContent = 'Checking engine configuration…';
  $('load-progress').hidden = false; $('load-progress').value = 0; $('load-progress').max = 1;
  $('release').disabled = false; $('retry').hidden = true; updateMetrics(); render();
  try {
    const response = await fetch('../lab/inference/config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Engine configuration unavailable');
    const config = await response.json();
    if (thisBoot !== boot) return;
    worker = new Worker(new URL('./engine.mjs?v=20261027-study1', import.meta.url), { type: 'module' });
    const activeWorker = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== activeWorker) return;
      if (data.type === 'progress') {
        diagnostics.downloads = data.downloads;
        $('load-progress').max = data.downloads.reduce((sum, item) => sum + item.expectedBytes, 0);
        $('load-progress').value = data.downloads.reduce((sum, item) => sum + item.loadedBytes, 0);
        $('engine-status').textContent = data.downloads.map(item => `${item.name}: ${(item.loadedBytes / 1e6).toFixed(1)} / ${(item.expectedBytes / 1e6).toFixed(1)} MB${item.source === 'prototype cache' ? ' saved' : ''}`).join(' · ');
        updateMetrics();
      } else if (data.type === 'initializing') {
        $('engine-title').textContent = 'Preparing Maia.'; $('engine-status').textContent = 'Downloads verified. Creating the CPU session…'; $('load-progress').removeAttribute('value');
        syncShell();
      } else if (data.type === 'ready') {
        ready = true; loading = false; sessions++;
        diagnostics = { ...diagnostics, ...data.diagnostics, mainReadyMs: performance.now() - engineStart };
        $('engine-title').textContent = 'Maia is ready.'; $('engine-status').textContent = 'The engine stays loaded for your next move and your next game.';
        $('load-progress').hidden = true; updateMetrics(); render(); askMaia(); analysis.engineReady();
      } else if (data.type === 'analysis') {
        diagnostics = { ...diagnostics, ...data.diagnostics }; updateMetrics(); analysis.result(data);
      } else if (data.type === 'move') {
        diagnostics = { ...diagnostics, ...data.diagnostics }; updateMetrics();
        if (analysisOwnsEngine() || !currentReply(data, revision, game, human)) return;
        thinking = false;
        try {
          const move = game.move({ from: data.move.slice(0, 2), to: data.move.slice(2, 4), promotion: data.move[4] });
          if (!move) throw new Error('Illegal engine reply');
          lastMoveText = `Maia played ${move.san} · ${(data.ms / 1000).toFixed(2)} s`;
          diagnostics.lastReplyWaitMs = awaitingSince == null ? null : performance.now() - awaitingSince;
          diagnostics.firstReplyWaitMs ??= diagnostics.lastReplyWaitMs;
          awaitingSince = null; updateMetrics();
          render();
        } catch (error) { failed(error.message, data.diagnostics); }
      } else if (data.type === 'error' && (data.id === undefined || data.id === revision || data.id === analysis.requestId)) failed(data.error, data.diagnostics);
    };
    worker.onerror = event => { if (worker === activeWorker) failed(event.message || 'Engine worker stopped. Try loading Maia again.'); };
    worker.postMessage({ type: 'init', config, keep: $('keep').checked });
  } catch (error) { if (thisBoot === boot) failed(error.message); }
}
$('setup').addEventListener('submit', event => {
  event.preventDefault();
  revision++; thinking = false; lastMoveText = ''; engineError = ''; viewPly = null;
  human = $('side').value === 'random' ? (Math.random() < .5 ? 'w' : 'b') : $('side').value;
  rating = Number($('rating').value); game = createGame(human, rating, new Date(), pendingFen);
  pendingFen = null; $('custom-position').hidden = true; orientation = human; started = true; games++;
  board.focusSquare = human === 'w' ? 'e2' : 'e7';
  awaitingSince = game.turn() !== human ? performance.now() : null;
  showView('game', false); render(); $('start').textContent = 'New game'; updateMetrics(); board.focus();
  if (!ready) startEngine(); else askMaia();
});
$('undo').addEventListener('click', () => { if (takeBack(game, human)) { board.cancel(); revision++; thinking = false; viewPly = null; lastMoveText = ''; render(); } });
$('retry').addEventListener('click', startEngine);
$('release').addEventListener('click', () => stopEngine());
$('clear').addEventListener('click', async () => {
  try { if (self.caches) await caches.delete(CACHE_NAME); $('storage-status').textContent = 'Saved engine downloads cleared. A running session stays in memory until stopped or this tab closes.'; }
  catch (error) { $('storage-status').textContent = `Could not clear downloads: ${error.message}`; }
});
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('pgn').addEventListener('click', () => download(game.pgn() + '\n', `mobile-maia-game-${Date.now()}.pgn`, 'application/x-chess-pgn'));
$('diagnostics').addEventListener('click', () => download(JSON.stringify(startupReport(), null, 2) + '\n', `mobile-maia-play-startup-${Date.now()}.json`, 'application/json'));
render();
if (self.isSecureContext && self.Worker && self.WebAssembly && self.crypto?.subtle && self.BigInt64Array) $('start').disabled = false;
else $('engine-status').textContent = 'This browser lacks a required secure context, worker, WebAssembly or BigInt capability.';
