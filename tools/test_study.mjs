// Node built-ins only. No engine download or DOM emulation.
import assert from 'node:assert/strict';
import { Study, validPosition, pvSan } from '../site/play/study.mjs';
import { moveIndex, legalMoveProbabilities } from '../site/play/policy.mjs';
import { StockfishClient, parseInfo, scoreText } from '../site/play/stockfish.mjs';
import { createGame } from '../site/play/game.mjs';

const pgn = '[Event "Branches"]\n[Result "*"]\n\n1. e4 {King pawn} (1. d4 d5 (1... Nf6 $5) 2. c4) e5 2. Nf3 (2. Bc4 Nc6) Nc6 *';
const study = Study.fromPgn(pgn);
assert.deepEqual(study.path().map(n => n.move.san), ['e4','e5','Nf3','Nc6']);
assert.equal(study.root.children.length,2);
assert.equal(study.root.children[1].children.length,2);
assert.deepEqual(study.root.children[1].children[1].nags,[5]);
assert.equal(study.root.children[0].comments[0],'King pawn');
study.first(); study.play('c4'); study.play('e5');
assert.equal(study.root.children.length,3); // the old mainline and imported branch survive
const copy = Study.fromPgn(study.pgn());
assert.equal(copy.nodes.length, study.nodes.length);
assert.equal(copy.root.children.length,3);
assert.equal(copy.root.children[0].comments[0],'King pawn');
assert.deepEqual(copy.root.children[1].children[1].nags,[5]);
assert.deepEqual(copy.path().map(n => n.move.san), ['e4','e5','Nf3','Nc6']);
assert.throws(() => Study.fromPgn('1. e4 (1. d4 Ke7) e5 *'), /Invalid move/);
assert.throws(() => Study.fromPgn('1. e4 e5 *\n1. d4 d5 *'));
assert.throws(() => Study.fromPgn('1. e4 (1. d4 d5 *'));
assert.throws(() => new Study('8/8/8/8/8/8/4k3/4K3 w - - 0 1'), /king in check/);
assert.throws(() => new Study('7k/8/8/8/8/8/8/K7 w K - 0 1'), /Castling/);
const commented = Study.fromPgn('1. e4 {Keep [Event "a quote"] here} ({Alternative start} 1. d4 d5) e5 1-0');
assert.equal(commented.root.children[0].comments[0], 'Keep [Event "a quote"] here');
assert.equal(commented.root.children[1].startingComments[0], 'Alternative start');
assert.equal(Study.fromPgn(commented.pgn()).root.children[1].startingComments[0], 'Alternative start');
assert.equal(commented.headers.Result,'1-0');
commented.play('Nf3'); assert.equal(commented.headers.Result,'*');
const custom = new Study('r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 21');
custom.play('exd6'); custom.play('O-O-O'); custom.play('O-O');
assert.deepEqual(Study.fromPgn(custom.pgn()).path().map(n => n.move.san), ['exd6','O-O-O','O-O']);
const continued = createGame('b',1600,new Date(), custom.root.fen);
assert.equal(continued.fen(), custom.root.fen);
assert.equal(continued.getHeaders().SetUp,'1');
assert.equal(continued.getHeaders().FEN, custom.root.fen);
const promoted = new Study('7k/P7/8/8/8/8/8/7K w - - 0 1');
promoted.play({from:'a7',to:'a8',promotion:'n'});
assert.equal(Study.fromPgn(promoted.pgn()).current.move.promotion,'n');
assert.deepEqual(pvSan(custom.root.fen,['e5d6','e8c8','e1g1']), ['21. exd6','21… O-O-O','22. O-O']);
assert.deepEqual(pvSan(custom.root.fen,['e5e4','e8c8']),[]); // reject invalid PV continuation
assert.equal(validPosition(custom.root.fen).turn(),'w');

const logits = new Float32Array(4352).fill(-1000);
logits[moveIndex('e2e4')] = Math.log(3); logits[moveIndex('d2d4')] = 0;
logits[moveIndex('a1h8')] = 1000; // illegal policy mass is excluded
const policy = legalMoveProbabilities(['e2e4','d2d4'],logits,false);
assert.ok(Math.abs(policy[0].probability-.75) < 1e-7);
assert.deepEqual(legalMoveProbabilities(['e7e5','d7d5'],logits,true).map(x=>x.move),['e7e5','d7d5']);
assert.ok(Math.abs(legalMoveProbabilities(['e7e5','d7d5'],logits,true)[0].probability-.75)<1e-7);
assert.deepEqual(legalMoveProbabilities([],logits,false),[]);
logits[moveIndex('e2e4')] = NaN;
assert.throws(() => legalMoveProbabilities(['e2e4'],logits,false), /Non-finite/);
const white = custom.root.fen, black = '7k/8/8/8/8/8/8/K7 b - - 0 1';
assert.equal(scoreText(parseInfo('info depth 12 multipv 1 score cp -23 pv a1a2 h8h7',white)),'−0.23');
assert.equal(scoreText(parseInfo('info depth 8 multipv 2 score mate -3 pv h8h7',black)),'+M3');
assert.equal(parseInfo('info string NNUE loaded',white),null);
assert.ok(parseInfo('info depth 6 score cp 42 lowerbound pv a1a2',white).bound);

// A stop/bestmove boundary must drain before the next position. Old info and
// cancelled-position results cannot be attributed to a newer request.
const commands = [], lines = [], statuses = [];
const client = new StockfishClient(status => statuses.push(status), line => lines.push(line));
client.worker = {postMessage: command => commands.push(command), terminate() {}}; client.ready = true;
client.analyze(white,'first',false);
client.analyze(black,'second',false);
assert.equal(commands.at(-1),'stop');
client.message('info depth 9 score cp 123 pv e5d6'); assert.equal(lines.length,0);
client.message('bestmove e5d6');
assert.equal(commands.at(-2),'position fen '+black);
client.message('info depth 7 multipv 1 score cp -15 pv h8h7');
assert.equal(lines.length,1); assert.equal(lines[0].id,'second'); assert.equal(lines[0].value,15);
client.pause(); client.message('info depth 8 score cp -20 pv h8h7'); assert.equal(lines.length,1);
client.message('bestmove h8h7'); assert.equal(client.current,null); client.stop();
console.log('PASS: PGN trees/comments/NAGs, branches, FEN/castling/EP/promotion round trips, continued games, raw legal policy, stale/cancelled UCI results.');
