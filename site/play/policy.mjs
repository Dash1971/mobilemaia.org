// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
// Same 4352-entry policy mapping as MaiaEncoding.moveIndex in the Android app.
export function moveIndex(uci, black = false) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid UCI move');
  const square = offset => (uci.charCodeAt(offset) - 97) + ((black ? 8 - Number(uci[offset + 1]) : Number(uci[offset + 1]) - 1) * 8);
  if (uci.length === 5) return 4096 + (((uci.charCodeAt(0) - 97) * 8 + uci.charCodeAt(2) - 97) * 4 + 'qrbn'.indexOf(uci[4]));
  return square(0) * 64 + square(2);
}

export function sampleMove(legal, logits, black, random = Math.random) {
  if (!legal.length || logits.length !== 4352) throw new Error('Invalid move policy');
  const values = legal.map(move => logits[moveIndex(move, black)]);
  if (!values.every(Number.isFinite)) throw new Error('Non-finite move policy');
  const max = Math.max(...values);
  const weights = values.map(value => Math.exp(value - max));
  let target = random() * weights.reduce((a, b) => a + b, 0);
  let lastPositive;
  for (let i = 0; i < legal.length; i++) {
    if (weights[i] === 0) continue;
    lastPositive = legal[i]; target -= weights[i]; if (target < 0) return legal[i];
  }
  return lastPositive;
}
