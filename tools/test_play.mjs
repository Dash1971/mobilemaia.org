// Node built-ins only. No model download or browser dependency.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Chess, uci, takeBack, currentReply, ending } from '../site/play/game.mjs';
import { moveIndex, sampleMove } from '../site/play/policy.mjs';

assert.equal(moveIndex('e2e4'), 796);
assert.equal(moveIndex('e7e5', true), 796);
assert.equal(moveIndex('e1g1'), 262);
assert.equal(moveIndex('e8g8', true), 262);
assert.equal(moveIndex('a7a8q'), 4096);
assert.equal(moveIndex('a2a1q', true), 4096);
assert.equal(moveIndex('h7h8n'), 4351);
assert.equal(moveIndex('h2h1n', true), 4351);
assert.notEqual(moveIndex('h7g8n'), moveIndex('h7g8q'));
assert.throws(() => moveIndex('e9e4'), /Invalid/);
const logits = new Float32Array(4352).fill(-1000);
logits[moveIndex('e2e4')] = 0; logits[moveIndex('d2d4')] = 0;
logits[moveIndex('a1h8')] = 1000; // illegal move must never enter sampling
assert.equal(sampleMove(['e2e4', 'd2d4'], logits, false, () => 0), 'e2e4');
assert.equal(sampleMove(['e2e4', 'd2d4'], logits, false, () => .999), 'd2d4');
assert.equal(sampleMove(['e7e5', 'd7d5'], logits, true, () => .999), 'd7d5');
logits[moveIndex('d2d4')] = -1000;
assert.equal(sampleMove(['d2d4', 'e2e4'], logits, false, () => 0), 'e2e4'); // skip underflowed zero mass
assert.throws(() => sampleMove([], logits, false), /Invalid/);
logits[796] = NaN;
assert.throws(() => sampleMove(['e2e4'], logits, false), /Non-finite/);

const game = new Chess();
assert.equal(game.moves().length, 20);
function perft(board, depth) {
  if (!depth) return 1;
  let count = 0;
  for (const move of board.moves({ verbose: true })) { board.move(move); count += perft(board, depth - 1); board.undo(); }
  return count;
}
assert.equal(perft(game, 3), 8902);
game.move('e4'); const request = { id: 1, fen: game.fen() };
assert.ok(currentReply(request, 1, game, 'w'));
assert.ok(!currentReply(request, 2, game, 'w'));
assert.ok(takeBack(game, 'w')); assert.equal(game.history().length, 0);
assert.ok(!currentReply(request, 1, game, 'w')); // late reply after undo
game.move('e4'); game.move('e5');
assert.ok(takeBack(game, 'w')); assert.equal(game.history().length, 0);
game.move('d4'); assert.ok(!takeBack(game, 'b')); // cannot undo Maia's opening alone
game.move('d5'); game.move('c4');
assert.ok(takeBack(game, 'b')); assert.deepEqual(game.history(), ['d4']);

const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
assert.ok(castle.moves({ verbose: true }).map(uci).includes('e1g1'));
castle.move('O-O'); assert.equal(castle.get('f1').type, 'r');
const ep = new Chess(); for (const move of ['e4', 'a6', 'e5', 'd5']) ep.move(move);
ep.move('exd6'); assert.equal(ep.get('d5'), undefined); assert.equal(ep.get('d6').type, 'p');
const promo = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
assert.deepEqual(promo.moves({ verbose: true }).filter(m => m.from === 'a7').map(m => m.promotion).sort(), ['b', 'n', 'q', 'r']);
promo.move({ from: 'a7', to: 'a8', promotion: 'n' }); assert.equal(promo.get('a8').type, 'n');
const mate = new Chess(); for (const move of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(move);
assert.equal(ending(mate, 'w'), 'Maia wins by checkmate.');
assert.ok(takeBack(mate, 'w')); assert.ok(!mate.isGameOver());
assert.equal(ending(new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'), 'w'), 'Draw by stalemate.');
const repeat = new Chess(); for (const move of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) repeat.move(move);
assert.equal(ending(repeat, 'w'), 'Draw by threefold repetition.');
const pgn = new Chess(); pgn.loadPgn(castle.pgn()); assert.equal(pgn.fen(), castle.fen());

const root = new URL('../site/play/', import.meta.url);
const assets = JSON.parse(await readFile(new URL('assets.json', root)));
for (const asset of assets.files) {
  const bytes = await readFile(new URL(asset.path, root));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
}
console.log('PASS: legal chess/perft, castling, en passant, promotions, draws, PGN, policy orientation/sampling, stale replies/takebacks and asset integrity.');
