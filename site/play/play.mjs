// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { Chess, createGame, uci, takeBack, currentReply, ending } from './game.mjs?v=20261027-play2';
import { CACHE_NAME } from '../lab/inference/core.mjs?v=20261027-5m';
const $ = id => document.getElementById(id);
const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
let game = new Chess(), human = 'w', rating = 1600, started = false, selected, promotionMoves;
let worker, ready = false, loading = false, thinking = false, revision = 0, boot = 0, focusSquare = 'e2';
let engineStart, diagnostics = {}, lastMoveText = '', engineError = '', sessions = 0, games = 0;
let awaitingSince;
const visibility = [{ at: new Date().toISOString(), state: document.visibilityState }];
document.addEventListener('visibilitychange', () => {
  visibility.push({ at: new Date().toISOString(), state: document.visibilityState });
});
const labelColor = color => color === 'w' ? 'White' : 'Black';
const squareButtons = new Map();
function makeBoard() {
  const files = human === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = human === 'w' ? '87654321' : '12345678';
  $('board').replaceChildren(); squareButtons.clear();
  for (const rank of ranks) for (const file of files) {
    const square = file + rank, button = document.createElement('button');
    button.type = 'button'; button.dataset.square = square;
    button.addEventListener('click', () => choose(square));
    button.addEventListener('keydown', event => {
      if (event.key === 'Escape') { selected = null; render(); return; }
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      const all = [...squareButtons.keys()], index = all.indexOf(square), next = index + delta;
      if (next < 0 || next >= 64 || (Math.abs(delta) === 1 && Math.floor(index / 8) !== Math.floor(next / 8))) return;
      focusSquare = all[next];
      for (const [s, b] of squareButtons) b.tabIndex = s === focusSquare ? 0 : -1;
      squareButtons.get(focusSquare).focus();
    });
    squareButtons.set(square, button); $('board').append(button);
  }
}
function render() {
  const history = game.history({ verbose: true }), last = history.at(-1);
  $('keep').disabled = loading;
  const canMove = started && game.turn() === human && !game.isGameOver();
  const destinations = selected && canMove ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  for (const [square, button] of squareButtons) {
    const piece = game.get(square), dark = (square.charCodeAt(0) + Number(square[1])) % 2 === 0;
    const checked = piece?.type === 'k' && piece.color === game.turn() && game.isCheck();
    button.className = `square${dark ? ' dark' : ''}${last && [last.from, last.to].includes(square) ? ' last' : ''}${selected === square ? ' selected' : ''}${destinations.includes(square) ? ' legal' : ''}${piece ? ' occupied' : ''}${checked ? ' checked' : ''}`;
    button.tabIndex = square === focusSquare ? 0 : -1;
    button.setAttribute('aria-label', `${square}, ${piece ? labelColor(piece.color) + ' ' + names[piece.type] : 'empty'}${destinations.includes(square) ? ', legal destination' : ''}${checked ? ', in check' : ''}`);
    button.setAttribute('aria-pressed', String(square === selected));
    const pieceKey = piece ? piece.color + piece.type : '';
    if (button.dataset.piece !== pieceKey) {
      button.dataset.piece = pieceKey; button.replaceChildren();
      if (piece) { const img = document.createElement('img'); img.src = `pieces/${piece.color}${piece.type.toUpperCase()}.svg`; img.alt = ''; img.draggable = false; button.append(img); }
      if (square[1] === (human === 'w' ? '1' : '8')) { const span = document.createElement('span'); span.className = 'coordinate file-coordinate'; span.textContent = square[0]; button.append(span); }
      if (square[0] === (human === 'w' ? 'a' : 'h')) { const span = document.createElement('span'); span.className = 'coordinate rank-coordinate'; span.textContent = square[1]; button.append(span); }
    }
  }
  $('opponent').textContent = `Maia 5M · ${rating}`;
  $('human-color').textContent = labelColor(human); $('opponent-color').textContent = labelColor(human === 'w' ? 'b' : 'w');
  const end = ending(game, human);
  if (end) $('game-status').textContent = end;
  else if (!started) $('game-status').textContent = 'Choose your side, then start a game.';
  else if (game.turn() === human) $('game-status').textContent = `Your move.${game.isCheck() ? ' You are in check.' : ''}${loading ? ' Maia is loading in the background.' : ''}`;
  else if (engineError) $('game-status').textContent = 'Maia could not continue. Load Maia to retry; your position is kept.';
  else if (!ready) $('game-status').textContent = loading ? 'Maia is loading. Your position is ready and waiting.' : 'Load Maia to continue this game.';
  else $('game-status').textContent = 'Maia is thinking…';
  $('undo').disabled = !history.some(move => move.color === human);
  $('board').setAttribute('aria-busy', String(thinking));
  $('pgn').disabled = history.length === 0;
  $('last-move').textContent = lastMoveText;
  $('moves').replaceChildren();
  for (let i = 0; i < history.length; i += 2) {
    const li = document.createElement('li'); li.textContent = `${i / 2 + 1}. ${history[i].san}  ${history[i + 1]?.san || ''}`; $('moves').append(li);
  }
  $('moves').scrollTop = $('moves').scrollHeight; $('empty-moves').hidden = history.length > 0;
  if (end) game.setHeader('Result', game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2');
  else game.setHeader('Result', '*');
}
function choose(square) {
  if (!started || game.turn() !== human || game.isGameOver() || promotionMoves) return;
  focusSquare = square;
  const legal = selected ? game.moves({ square: selected, verbose: true }).filter(move => move.to === square) : [];
  if (legal.length) {
    if (legal.some(move => move.promotion)) { promote(legal); return; }
    playHuman(legal[0]); return;
  }
  const piece = game.get(square);
  selected = piece?.color === human && selected !== square ? square : null;
  render();
}
function playHuman(move) {
  game.move({ from: move.from, to: move.to, promotion: move.promotion });
  awaitingSince = performance.now();
  selected = null; lastMoveText = ''; revision++; render(); askMaia();
}
function promote(moves) {
  promotionMoves = moves; $('promotion-options').replaceChildren();
  for (const type of ['q', 'r', 'b', 'n']) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', `Promote to ${names[type]}`);
    const image = document.createElement('img'); image.src = `pieces/${human}${type.toUpperCase()}.svg`; image.alt = ''; button.append(image);
    button.addEventListener('click', () => { const move = promotionMoves.find(move => move.promotion === type); promotionMoves = null; $('promotion').close(); playHuman(move); });
    $('promotion-options').append(button);
  }
  $('promotion').showModal();
}
$('promotion-cancel').addEventListener('click', () => $('promotion').close());
$('promotion').addEventListener('close', () => { promotionMoves = null; render(); });
function askMaia() {
  if (!started || !ready || thinking || game.turn() === human || game.isGameOver()) return;
  thinking = true;
  const id = ++revision;
  worker.postMessage({ type: 'move', id, fen: game.fen(), rating, legal: game.moves({ verbose: true }).map(uci) });
  render();
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
}
function startupReport() {
  return { ...diagnostics, sessionsCreated: sessions, gamesStarted: games,
    engineReady: ready, engineLoading: loading, visibilityChanges: visibility, page: location.href,
    device: { userAgent: navigator.userAgent, logicalCores: navigator.hardwareConcurrency, crossOriginIsolated: self.crossOriginIsolated } };
}
function stopEngine(reason = 'Maia is stopped. Load Maia to continue.') {
  boot++; revision++; worker?.terminate(); worker = null; ready = false; loading = false; thinking = false;
  $('release').disabled = true; $('retry').hidden = !started; $('load-progress').hidden = true;
  $('engine-title').textContent = 'Engine stopped.'; $('engine-status').textContent = reason;
  render(); updateMetrics();
}
function failed(message, data) {
  if (data) diagnostics = { ...diagnostics, ...data };
  stopEngine(message); engineError = message;
  diagnostics.error = message; diagnostics.failedAt = new Date().toISOString();
  $('engine-title').textContent = 'A loading problem.'; updateMetrics(); render();
}
async function startEngine() {
  if (ready || loading) return;
  loading = true; engineError = ''; engineStart = performance.now();
  const thisBoot = ++boot;
  diagnostics = { startedAt: new Date().toISOString(), version: '20261027-play2', downloads: [] };
  $('engine-title').textContent = 'Loading Maia.'; $('engine-status').textContent = 'Checking engine configuration…';
  $('load-progress').hidden = false; $('load-progress').value = 0; $('load-progress').max = 1;
  $('release').disabled = false; $('retry').hidden = true; updateMetrics(); render();
  try {
    const response = await fetch('../lab/inference/config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Engine configuration unavailable');
    const config = await response.json();
    if (thisBoot !== boot) return;
    worker = new Worker(new URL('./engine.mjs?v=20261027-play2', import.meta.url), { type: 'module' });
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
      } else if (data.type === 'ready') {
        ready = true; loading = false; sessions++;
        diagnostics = { ...diagnostics, ...data.diagnostics, mainReadyMs: performance.now() - engineStart };
        $('engine-title').textContent = 'Maia is ready.'; $('engine-status').textContent = 'The engine stays loaded for your next move and your next game.';
        $('load-progress').hidden = true; updateMetrics(); render(); askMaia();
      } else if (data.type === 'move') {
        diagnostics = { ...diagnostics, ...data.diagnostics }; updateMetrics();
        if (!currentReply(data, revision, game, human)) return;
        thinking = false;
        try {
          const move = game.move({ from: data.move.slice(0, 2), to: data.move.slice(2, 4), promotion: data.move[4] });
          if (!move) throw new Error('Illegal engine reply');
          lastMoveText = `Maia played ${move.san} · ${(data.ms / 1000).toFixed(2)} s`;
          diagnostics.lastReplyWaitMs = awaitingSince == null ? null : performance.now() - awaitingSince;
          diagnostics.firstReplyWaitMs ??= diagnostics.lastReplyWaitMs;
          awaitingSince = null; updateMetrics();
          selected = null; render();
        } catch (error) { failed(error.message, data.diagnostics); }
      } else if (data.type === 'error' && (data.id === undefined || data.id === revision)) failed(data.error, data.diagnostics);
    };
    worker.onerror = event => { if (worker === activeWorker) failed(event.message || 'Engine worker stopped. Try loading Maia again.'); };
    worker.postMessage({ type: 'init', config, keep: $('keep').checked });
  } catch (error) { if (thisBoot === boot) failed(error.message); }
}
$('setup').addEventListener('submit', event => {
  event.preventDefault();
  revision++; thinking = false; selected = null; lastMoveText = ''; engineError = '';
  human = $('side').value; rating = Number($('rating').value); game = createGame(human, rating); started = true; games++;
  focusSquare = human === 'w' ? 'e2' : 'e7';
  awaitingSince = human === 'b' ? performance.now() : null;
  makeBoard(); render(); $('start').textContent = 'New game'; updateMetrics();
  squareButtons.get(focusSquare).focus({ preventScroll: true });
  if (!ready) startEngine(); else askMaia();
  if (matchMedia('(max-width:760px)').matches) $('board').scrollIntoView({ block: 'center', behavior: 'smooth' });
});
$('undo').addEventListener('click', () => { if (takeBack(game, human)) { revision++; thinking = false; selected = null; lastMoveText = ''; render(); } });
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
makeBoard(); render();
if (self.isSecureContext && self.Worker && self.WebAssembly && self.crypto?.subtle && self.BigInt64Array) $('start').disabled = false;
else $('engine-status').textContent = 'This browser lacks a required secure context, worker, WebAssembly or BigInt capability.';
