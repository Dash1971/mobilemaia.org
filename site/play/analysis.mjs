// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { ChessBoard } from './board.mjs?v=20261027-study1';
import { Study, moveLabel, pvSan } from './study.mjs?v=20261027-study1';
import { uci } from './game.mjs?v=20261027-study1';
import { StockfishClient, scoreText } from './stockfish.mjs?v=20261027-study1';
const $ = id => document.getElementById(id);

export class AnalysisView {
  constructor(host) {
    this.host = host; this.study = new Study(); this.orientation = 'w'; this.revision = 0; this.active = false; this.enabled = true;
    this.maia = []; this.lines = new Map();
    this.board = new ChessBoard($('analysis-board'), moves => this.commit(moves));
    this.stockfish = new StockfishClient(status => { $('sf-status').textContent = status; }, line => {
      if (line.id !== this.requestId || line.fen !== this.study.current.fen || !this.active || !this.enabled) return;
      if (!pvSan(line.fen, line.moves, 1).length) return;
      this.lines.set(line.index, line); this.renderEngines();
    });
    $('analysis-flip').addEventListener('click', () => { this.orientation = this.orientation === 'w' ? 'b' : 'w'; this.renderBoard(); });
    for (const action of ['first','previous','next','last']) $('analysis-' + action).addEventListener('click', () => { this.study[action](); this.changed(); });
    $('analysis-reset').addEventListener('click', () => { this.study = new Study(); this.changed(); });
    $('analysis-rating').addEventListener('change', () => { if ($('analysis-rating').reportValidity()) this.changed(); });
    $('analysis-toggle').addEventListener('click', () => {
      this.enabled = !this.enabled; $('analysis-toggle').textContent = this.enabled ? 'Pause engines' : 'Resume engines';
      if (this.enabled) this.changed();
      else { this.cancelRequest(); $('maia-status').textContent = 'Analysis paused'; $('sf-status').textContent = 'Analysis paused'; }
    });
    $('analysis-retry').addEventListener('click', () => this.changed());
    $('analysis-show-lines').addEventListener('click', () => {
      const scroll = $('app-content'), heading = $('maia-heading');
      scroll.scrollTop += heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 10;
    });
    $('analysis-continue').addEventListener('click', () => this.host.continueFrom(this.study.current.fen));
    $('analysis-export').addEventListener('click', () => this.host.download(this.study.pgn(), `mobile-maia-analysis-${Date.now()}.pgn`, 'application/x-chess-pgn'));
    $('analysis-import-form').addEventListener('submit', event => { event.preventDefault(); this.importText(); });
    $('analysis-file').addEventListener('change', async () => {
      const file = $('analysis-file').files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { $('analysis-import-status').textContent = 'PGN must be smaller than 2 MB.'; return; }
      try { $('analysis-source').value = await file.text(); this.importText('pgn'); }
      catch (error) { $('analysis-import-status').textContent = error.message; }
      $('analysis-file').value = '';
    });
    $('analysis-copy-fen').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(this.study.current.fen); $('analysis-fen-status').textContent = 'FEN copied.'; }
      catch { $('analysis-fen-status').textContent = 'Select the FEN above to copy it.'; }
    });
    this.render();
  }
  enter(pgn, orientation) {
    if (pgn !== undefined) {
      try { this.study = Study.fromPgn(pgn); }
      catch (error) { $('analysis-import-status').textContent = error.message; }
      if (orientation) this.orientation = orientation;
    }
    this.active = true; this.changed();
  }
  leave() { this.active = false; this.board.cancel(); this.cancelRequest(); }
  stop() { this.cancelRequest(); this.stockfish.stop(); $('maia-status').textContent = 'Engine stopped'; $('sf-status').textContent = 'Engine stopped'; }
  cancelRequest() { clearTimeout(this.timer); this.requestId = `study:${++this.revision}`; this.stockfish.pause(); }
  changed() {
    this.cancelRequest(); this.maia = []; this.lines.clear(); this.render(); this.renderEngines();
    this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    if (!this.active || !this.enabled) return;
    if (!$('analysis-rating').checkValidity()) { $('maia-status').textContent = 'Choose a whole-number rating from 600 to 2600.'; return; }
    const game = this.study.game();
    if (!game.moves().length) { $('maia-status').textContent = game.isCheckmate() ? 'Checkmate · no legal moves' : 'Stalemate · no legal moves'; $('sf-status').textContent = 'No legal continuations'; return; }
    $('maia-status').textContent = 'Maia 5M · waiting…';
    this.timer = setTimeout(() => {
      if (!this.active || !this.enabled) return;
      const fen = this.study.current.fen, id = this.requestId;
      this.host.requestMaia({ type: 'analysis', id, fen, rating: Number($('analysis-rating').value), legal: this.study.game().moves({ verbose: true }).map(uci) });
      this.stockfish.analyze(fen, id, this.host.keep());
    }, 180);
  }
  engineReady() { this.schedule(); }
  maiaError(message) { if (this.active) $('maia-status').textContent = 'Maia unavailable: ' + message; }
  result(data) {
    if (!this.active || !this.enabled || data.id !== this.requestId || data.fen !== this.study.current.fen) return;
    this.maia = data.probabilities; $('maia-status').textContent = `Maia 5M · ${$('analysis-rating').value} · ${data.ms.toFixed(0)} ms`;
    this.renderEngines();
  }
  importText(kind = $('analysis-format').value) {
    try {
      const source = $('analysis-source').value.trim();
      if (!source) throw new Error('Paste a PGN or FEN first.');
      const next = kind === 'fen' ? new Study(source) : Study.fromPgn(source);
      this.study = next; this.changed(); $('analysis-import-status').textContent = 'Imported. The analysis board is ready.';
    } catch (error) { $('analysis-import-status').textContent = `Import failed: ${error.message} Your study is unchanged.`; }
  }
  commit(moves) {
    const fen = this.study.current.fen;
    this.host.promote(moves, move => {
      if (!this.active || this.study.current.fen !== fen) return;
      try { this.study.play({ from: move.from, to: move.to, promotion: move.promotion }); this.changed(); }
      catch (error) { $('analysis-import-status').textContent = error.message; }
    });
  }
  playUci(value) {
    try { this.commit([this.study.game().moves({ verbose: true }).find(move => uci(move) === value)].filter(Boolean)); }
    catch (error) { $('analysis-import-status').textContent = error.message; }
  }
  renderBoard() {
    this.board.update({ game: this.study.game(), orientation: this.orientation, movable: true,
      hints: this.host.hints(), highlight: this.host.highlight(), lastMove: this.study.current.move,
      coordinates: this.host.coordinates(), animation: this.host.animation(),
      arrows: [this.lines.get(1) && { move: this.lines.get(1).moves[0], color: '#2e86dd', width: 18 },
        this.maia[0] && { move: this.maia[0].move, color: '#337e40', width: 10 }].filter(Boolean) });
  }
  render() {
    this.renderBoard();
    const node = this.study.current, game = this.study.game();
    $('analysis-turn').textContent = `${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' · Check' : ''}`;
    $('analysis-fen').value = node.fen;
    $('analysis-fen-status').textContent = '';
    for (const action of ['first','previous']) $('analysis-' + action).disabled = !node.parent;
    for (const action of ['next','last']) $('analysis-' + action).disabled = !node.children.length;
    const tree = $('analysis-tree'), restoreFocus = tree.contains(document.activeElement); tree.replaceChildren();
    const addButton = (item, depth, container = tree) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tree-move';
      button.style.setProperty('--branch-depth', Math.min(depth, 5));
      button.textContent = item.move ? moveLabel(item.parent.fen, item.move.san) : 'Start';
      button.setAttribute('aria-current', String(item === node)); button.dataset.node = item.id;
      if (item.comments.length || item.startingComments.length) button.title = [...item.startingComments,...item.comments].join(' ');
      button.addEventListener('click', () => { this.study.select(item.id); this.changed(); }); container.append(button);
    };
    addButton(this.study.root, 0);
    const visit = (parent, depth, container = tree) => {
      if (!parent.children.length) return;
      const [main, ...others] = parent.children;
      addButton(main, depth, container);
      for (const alternate of others) {
        const branch = document.createElement('span'); branch.className = 'variation-group'; branch.setAttribute('aria-label', 'Variation');
        branch.append('('); addButton(alternate, depth + 1, branch); visit(alternate, depth + 1, branch); branch.append(')'); container.append(branch);
      }
      visit(main, depth, container);
    };
    visit(this.study.root, 0);
    const current = tree.querySelector('[aria-current="true"]');
    if (restoreFocus) current?.focus({preventScroll:true});
    if (current) {
      const item = current.getBoundingClientRect(), bounds = tree.getBoundingClientRect();
      if (item.bottom > bounds.bottom) tree.scrollTop += item.bottom - bounds.bottom;
      else if (item.top < bounds.top) tree.scrollTop += item.top - bounds.top;
    }
    $('analysis-comment').textContent = [...node.startingComments,...node.comments].join(' ');
    $('analysis-position').textContent = node.move ? moveLabel(node.parent.fen, node.move.san) : 'Starting position';
  }
  renderEngines() {
    $('analysis-summary-maia').textContent = this.maia[0] ? `Maia · ${pvSan(this.study.current.fen, [this.maia[0].move])[0]} · ${(this.maia[0].probability * 100).toFixed(1)}%` : 'Maia · waiting';
    const best = this.lines.get(1);
    $('analysis-summary-sf').textContent = best ? `Stockfish · ${pvSan(this.study.current.fen, best.moves, 1)[0]} · ${scoreText(best)} (White)` : 'Stockfish · waiting';
    const maia = $('maia-lines'); maia.replaceChildren();
    for (const entry of this.maia.slice(0,5)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'engine-line maia-line'; button.dataset.move = entry.move;
      const label = pvSan(this.study.current.fen, [entry.move])[0];
      button.textContent = `${label} · ${(entry.probability * 100).toFixed(1)}%`;
      button.style.setProperty('--probability', `${entry.probability * 100}%`);
      button.addEventListener('click', () => this.playUci(entry.move)); maia.append(button);
    }
    const sf = $('sf-lines'); sf.replaceChildren();
    for (const [index, entry] of [...this.lines].sort((a,b) => a[0] - b[0])) {
      const san = pvSan(this.study.current.fen, entry.moves);
      if (!san.length) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'engine-line sf-line'; button.dataset.move = entry.moves[0];
      button.textContent = `${index}. ${scoreText(entry)}${entry.bound ? ' (bound)' : ''} · depth ${entry.depth}\n${san.join(' ')}`;
      button.addEventListener('click', () => this.playUci(entry.moves[0])); sf.append(button);
    }
    this.renderBoard();
  }
}
