// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { Chess, DEFAULT_POSITION, validateFen } from './vendor/chess.mjs';
import { uci } from './game.mjs?v=20261027-study1';

export function validPosition(fen) {
  const result = validateFen(fen);
  if (!result.ok) throw new Error(result.error);
  const game = new Chess(fen), turn = game.turn(), other = turn === 'w' ? 'b' : 'w';
  const king = game.board().flat().find(piece => piece?.color === other && piece.type === 'k');
  if (game.isAttacked(king.square, turn)) throw new Error('The side that just moved cannot leave its king in check.');
  const rights = fen.split(/\s+/)[2];
  for (const [right, color, rook, square] of [['K','w','h1','e1'],['Q','w','a1','e1'],['k','b','h8','e8'],['q','b','a8','e8']]) {
    if (rights.includes(right) && (game.get(square)?.type !== 'k' || game.get(square)?.color !== color || game.get(rook)?.type !== 'r' || game.get(rook)?.color !== color)) throw new Error('Castling rights do not match the king and rooks.');
  }
  return game;
}
export function moveLabel(fen, san) {
  const fields = fen.split(' ');
  return `${fields[5]}${fields[1] === 'w' ? '.' : '…'} ${san}`;
}
export function pvSan(fen, moves, max = 12) {
  const game = new Chess(fen), result = [];
  for (const value of moves.slice(0, max)) {
    try { const move = game.move({ from: value.slice(0,2), to: value.slice(2,4), promotion: value[4] }); result.push(moveLabel(move.before, move.san)); }
    catch { break; }
  }
  return result;
}
export class Study {
  constructor(fen = DEFAULT_POSITION) {
    const game = validPosition(fen);
    this.nodes = [];
    this.headers = { Event: 'Mobile Maia browser analysis', Site: 'https://mobilemaia.org/play/', Result: '*' };
    if (game.fen() !== DEFAULT_POSITION) Object.assign(this.headers, { SetUp: '1', FEN: game.fen() });
    this.root = this.node(null, game.fen()); this.current = this.root;
  }
  node(parent, fen, move = null) {
    if (this.nodes.length >= 4000) throw new Error('This study is limited to 4,000 positions.');
    const node = { id: this.nodes.length, parent, fen, move, children: [], comments: [], startingComments: [], nags: [] };
    this.nodes.push(node); if (parent) parent.children.push(node); return node;
  }
  path(node = this.current) { const result = []; for (; node.parent; node = node.parent) result.unshift(node); return result; }
  game(node = this.current) {
    const game = new Chess(this.root.fen);
    for (const [key, value] of Object.entries(this.headers)) game.setHeader(key, value);
    for (const item of this.path(node)) game.move(item.move);
    return game;
  }
  select(id) { const node = this.nodes[id]; if (!node) throw new Error('Unknown study position'); this.current = node; }
  play(move) {
    if (this.path().length >= 512) throw new Error('This line is limited to 512 moves.');
    const game = new Chess(this.current.fen), played = game.move(move), key = uci(played);
    let node = this.current.children.find(node => uci(node.move) === key);
    if (!node) {
      if (!this.current.children.length && this.path().every(item => item.parent.children[0] === item)) this.headers.Result = '*';
      node = this.node(this.current, game.fen(), played);
    }
    this.current = node;
    return this.current;
  }
  first() { this.current = this.root; }
  previous() { this.current = this.current.parent || this.current; }
  next() { this.current = this.current.children[0] || this.current; }
  last() { while (this.current.children.length) this.next(); }
  pgn() {
    const comment = value => `{${value.replace(/[{}]/g, '')}}`;
    const tokens = node => [...node.startingComments.map(comment), moveLabel(node.parent.fen, node.move.san).replace('…', '...'), ...node.nags.map(nag => `$${nag}`), ...node.comments.map(comment)];
    const continuation = parent => {
      if (!parent.children.length) return [];
      const [main, ...others] = parent.children;
      return [...tokens(main), ...others.map(node => `(${[...tokens(node), ...continuation(node)].join(' ')})`), ...continuation(main)];
    };
    const headers = Object.entries(this.headers).map(([key,value]) => `[${key} "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`).join('\n');
    return `${headers}\n\n${[...this.root.comments.map(comment), ...continuation(this.root), this.headers.Result || '*'].join(' ')}\n`;
  }
  static fromPgn(source) {
    if (new TextEncoder().encode(source).length > 2 * 1024 * 1024) throw new Error('PGN must be smaller than 2 MB.');
    // The existing parser validates headers and mainline; below we also validate
    // every RAV instead of silently discarding imported variations.
    const parsed = new Chess(); parsed.loadPgn(source);
    const headers = parsed.getHeaders(), study = new Study(headers.FEN || DEFAULT_POSITION);
    study.headers = { ...study.headers, ...headers };
    let text = source.replace(/^\uFEFF/, '').trimStart();
    // Remove the leading tag section only. Bracketed text inside comments is data.
    while (text.startsWith('[')) {
      const tag = text.match(/^\[[A-Za-z0-9_+#=:-]+\s+"(?:[^"\\]|\\.)*"\]/);
      if (!tag) throw new Error('Invalid PGN tag.');
      text = text.slice(tag[0].length).trimStart();
    }
    const stack = []; let starting = [], atVariationStart = false;
    const addComment = comment => { (atVariationStart ? starting : study.current.comments).push(comment); };
    while (text.trim()) {
      text = text.trimStart();
      let match;
      if (text[0] === '{') {
        const end = text.indexOf('}'); if (end < 0) throw new Error('Unclosed PGN comment.');
        addComment(text.slice(1,end).trim()); text = text.slice(end+1); continue;
      }
      if (text[0] === ';' || text[0] === '%') { const end = text.indexOf('\n'); addComment(text.slice(1,end < 0 ? undefined : end).trim()); text = end < 0 ? '' : text.slice(end+1); continue; }
      if (text[0] === '(') {
        if (!study.current.parent || stack.length >= 64) throw new Error('Invalid or excessively nested PGN variation.');
        stack.push({node:study.current,starting,atVariationStart}); study.previous(); starting = []; atVariationStart = true; text = text.slice(1); continue;
      }
      if (text[0] === ')') {
        if (!stack.length || atVariationStart) throw new Error('Unmatched or empty PGN variation.');
        const saved = stack.pop(); study.current = saved.node; starting = saved.starting; atVariationStart = saved.atVariationStart;
        text = text.slice(1); continue;
      }
      if ((match = text.match(/^\d+\.(?:\.\.)?/))) { text = text.slice(match[0].length); continue; }
      if ((match = text.match(/^\$(\d+)/))) { study.current.nags.push(Number(match[1])); text = text.slice(match[0].length); continue; }
      match = text.match(/^[^\s(){};]+/); if (!match) throw new Error('Invalid PGN token.');
      let token = match[0]; text = text.slice(token.length);
      if (['1-0','0-1','1/2-1/2','*'].includes(token)) { if (!stack.length && text.trim().replace(/\{[^}]*\}/g,'').trim()) throw new Error('Import one game at a time.'); continue; }
      const annotation = token.match(/[!?]+$/)?.[0];
      token = token.replace(/[!?]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
      study.play(token);
      study.current.startingComments.push(...starting); starting = []; atVariationStart = false;
      if (annotation) study.current.nags.push(({ '!':1, '?':2, '!!':3, '??':4, '!?':5, '?!':6 })[annotation] || 0);
    }
    if (stack.length) throw new Error('Unclosed PGN variation.');
    study.headers.Result = headers.Result || '*';
    study.first(); study.last(); return study;
  }
}
