// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
export const CACHE_NAME = 'mobile-maia-inference-downloads-v1';

// Port of MaiaEncoding.historicalTokens/tokenizeFen at the pinned app commit.
// Each historical board uses its own side-to-move orientation; channel 96 is zero.
export function encode(history, useHistory) {
  if (!history.length) throw new Error('No reference position');
  const window = useHistory ? history.slice(-8) : history.slice(-1);
  while (window.length < 8) window.unshift(window[0]);
  const tokens = new Float32Array(64 * 97);
  window.forEach((fen, frame) => {
    const [placement, side] = fen.split(' ');
    const black = side === 'b';
    placement.split('/').forEach((rank, rankIndex) => {
      let file = 0;
      for (const symbol of rank) {
        if (/^[1-8]$/.test(symbol)) { file += Number(symbol); continue; }
        const piece = 'pnbrqk'.indexOf(symbol.toLowerCase());
        if (piece < 0 || file > 7) throw new Error('Invalid fixture FEN');
        const square = (black ? rankIndex : 7 - rankIndex) * 8 + file;
        const own = (symbol === symbol.toUpperCase()) !== black;
        tokens[square * 97 + frame * 12 + piece + (own ? 0 : 6)] = 1;
        file++;
      }
      if (file !== 8) throw new Error('Invalid fixture rank');
    });
  });
  return tokens;
}

export async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function whiteScore(logits, fen) {
  if (logits.length !== 3 || !Array.from(logits).every(Number.isFinite)) throw new Error('Invalid value output');
  const max = Math.max(...logits);
  const exp = Array.from(logits, x => Math.exp(x - max));
  const stm = (exp[2] + 0.5 * exp[1]) / exp.reduce((a, b) => a + b, 0);
  return fen.split(' ')[1] === 'w' ? stm : 1 - stm;
}

export function statistics(values) {
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid timing sample');
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  const mid = sorted.length / 2;
  return { count: values.length, medianMs: sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2,
    p95Ms: percentile(0.95), meanMs: values.reduce((a, b) => a + b, 0) / values.length,
    minMs: sorted[0], maxMs: sorted.at(-1) };
}
