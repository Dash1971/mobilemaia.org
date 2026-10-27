// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { Chess } from './vendor/chess.mjs';
export { Chess };
export function createGame(human, rating, now = new Date()) {
  const game = new Chess();
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const headers = { Event: 'Mobile Maia browser preview', Site: 'https://mobilemaia.org/play/',
    Date: date, Round: '-', White: human === 'w' ? 'You' : `Maia 5M (${rating})`,
    Black: human === 'b' ? 'You' : `Maia 5M (${rating})` };
  for (const [key, value] of Object.entries(headers)) game.setHeader(key, value);
  return game;
}
export const uci = move => move.from + move.to + (move.promotion || '');
export function takeBack(game, human) {
  const history = game.history({ verbose: true });
  if (!history.some(move => move.color === human)) return false;
  if (history.at(-1).color !== human) game.undo();
  game.undo();
  return true;
}
export function currentReply(reply, revision, game, human) {
  return reply.id === revision && reply.fen === game.fen() && game.turn() !== human && !game.isGameOver();
}
export function ending(game, human) {
  if (game.isCheckmate()) return game.turn() === human ? 'Maia wins by checkmate.' : 'You win by checkmate.';
  if (game.isStalemate()) return 'Draw by stalemate.';
  if (game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material.';
  if (game.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.';
  if (game.isDraw()) return 'Draw.';
  return '';
}
