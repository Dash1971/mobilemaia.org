// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { Chessground } from './vendor/chessground/chessground.min.js';
export const pieceNames = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const colorName = color => color === 'w' ? 'white' : 'black';
export class ChessBoard {
  constructor(element, onMove) {
    this.element = element; this.onMove = onMove; this.buttons = new Map(); this.orientation = 'w'; this.focusSquare = 'e2'; this.generation = 0;
    const visual = document.createElement('div'); visual.className = 'cg-wrap'; visual.setAttribute('aria-hidden','true');
    this.keyboard = document.createElement('div'); this.keyboard.className = 'keyboard-board';
    this.feedback = document.createElement('span'); this.feedback.className = 'visually-hidden'; this.feedback.setAttribute('role','status');
    element.replaceChildren(visual, this.keyboard, this.feedback);
    this.ground = Chessground(visual, { coordinates: true, ranksPosition: 'left', disableContextMenu: true,
      movable: { free: false }, draggable: { enabled: true, showGhost: true, deleteOnDropOff: false },
      animation: { enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 180 },
      premovable: { enabled: false, events: {
        set: () => { this.feedback.textContent = 'Premove queued. It will run only if legal after Maia replies.'; this.onPremove?.(true); },
        unset: () => { this.onPremove?.(false); }
      } },
      drawable: { enabled: true, visible: true },
      events: { select: () => this.renderKeyboard() }
    });
    this.buildKeyboard();
    this.observer = new ResizeObserver(() => { this.ground.state.dom.bounds.clear(); this.ground.redrawAll(); });
    this.observer.observe(element);
  }
  buildKeyboard() {
    this.keyboard.replaceChildren(); this.buttons.clear();
    const files = this.orientation === 'w' ? 'abcdefgh' : 'hgfedcba', ranks = this.orientation === 'w' ? '87654321' : '12345678';
    for (const rank of ranks) for (const file of files) {
      const square = file + rank, button = document.createElement('button');
      button.type = 'button'; button.dataset.square = square; button.className = 'keyboard-square';
      button.addEventListener('click', () => { this.focusSquare = square; this.ground.selectSquare(square); this.renderKeyboard(); });
      button.addEventListener('keydown', event => {
        if (event.key === 'Escape') { this.cancel(); return; }
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[event.key];
        if (delta === undefined) return;
        event.preventDefault(); const all = [...this.buttons.keys()], i = all.indexOf(square), next = i + delta;
        if (next < 0 || next >= 64 || (Math.abs(delta) === 1 && Math.floor(i/8) !== Math.floor(next/8))) return;
        this.focusSquare = all[next]; this.renderKeyboard(); this.focus();
      });
      this.buttons.set(square,button); this.keyboard.append(button);
    }
    this.renderKeyboard();
  }
  candidates(from, to) {
    if (!this.game) return [];
    // Lichess also accepts castling by moving the king onto its own rook.
    if (this.game.get(from)?.type === 'k' && this.game.get(to)?.type === 'r' && this.game.get(to)?.color === this.game.turn()) to = (to[0] === 'h' ? 'g' : 'c') + from[1];
    return this.game.moves({ square: from, verbose: true }).filter(move => move.to === to);
  }
  update(options) {
    const fen = options.game.fen(), changed = this.fen !== fen, coordinates = options.coordinates !== false;
    const rebuildCoordinates = this.coordinates !== coordinates; this.coordinates = coordinates;
    if (changed) this.generation++;
    if (this.orientation !== options.orientation) { this.cancel(); this.orientation = options.orientation; this.buildKeyboard(); }
    this.game = options.game; this.fen = fen; this.movable = options.movable;
    if (!options.premoveColor && this.ground.state.premovable.current) this.ground.cancelPremove();
    const dests = new Map();
    if (this.movable) for (const move of this.game.moves({ verbose: true })) {
      const squares = dests.get(move.from) || [];
      if (!squares.includes(move.to)) squares.push(move.to);
      if (move.flags.includes('k')) squares.push('h' + move.from[1]);
      if (move.flags.includes('q')) squares.push('a' + move.from[1]);
      dests.set(move.from,squares);
    }
    const config = { orientation: colorName(options.orientation), turnColor: colorName(this.game.turn()), coordinates,
      animation: { enabled: options.animation !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches },
      check: this.game.isCheck(), lastMove: options.lastMove ? [options.lastMove.from,options.lastMove.to] : undefined,
      highlight: { lastMove: options.highlight !== false, check: true },
      movable: { free: false, color: this.movable ? colorName(this.game.turn()) : options.premoveColor ? colorName(options.premoveColor) : undefined,
        dests, showDests: options.hints !== false, rookCastle: true, events: { after: this.afterMove() } },
      premovable: { enabled: !!options.premoveColor, showDests: options.hints !== false },
      drawable: { autoShapes: (options.arrows || []).map(arrow => ({ orig: arrow.move.slice(0,2), dest: arrow.move.slice(2,4), brush: arrow.color === '#2e86dd' ? 'blue' : 'green' })) }
    };
    // Avoid disturbing a drag/selection on unrelated engine progress updates.
    if (changed || this.ground.getFen() !== fen.split(' ')[0]) config.fen = fen;
    this.ground.set(config); this.renderKeyboard();
    if (rebuildCoordinates) this.ground.redrawAll();
    if (this.movable && this.ground.state.premovable.current) this.ground.playPremove();
  }
  renderKeyboard() {
    if (!this.game) return;
    const selected = this.ground.state.selected;
    const destinations = selected ? this.game.moves({square:selected,verbose:true}).map(move=>move.to) : [];
    for (const [square,button] of this.buttons) {
      const piece = this.game.get(square);
      button.tabIndex = square === this.focusSquare ? 0 : -1;
      button.setAttribute('aria-label', `${square}, ${piece ? colorName(piece.color) + ' ' + pieceNames[piece.type] : 'empty'}${destinations.includes(square) ? ', legal destination' : ''}${piece?.type === 'k' && piece.color === this.game.turn() && this.game.isCheck() ? ', in check' : ''}`);
      button.setAttribute('aria-pressed',String(selected === square));
    }
  }
  focus() { this.buttons.get(this.focusSquare)?.focus({ preventScroll: true }); }
  afterMove() {
    const generation = this.generation, fen = this.fen;
    return (from,to,metadata) => {
      if (generation !== this.generation || fen !== this.fen || !this.movable) return;
      let legal = this.candidates(from,to);
      if (metadata?.premove && legal.some(move => move.promotion)) legal = legal.filter(move => move.promotion === 'q');
      if (legal.length) { this.focusSquare = legal[0].to; this.onMove(legal); }
      else this.ground.set({ fen: this.fen });
    };
  }
  cancel() {
    this.generation++; this.ground?.cancelMove();
    if (this.ground) this.ground.set({movable:{events:{after:this.afterMove()}}});
    this.renderKeyboard();
  }
}
