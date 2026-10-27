// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { CACHE_NAME, sha256 } from '../lab/inference/core.mjs?v=20261027-5m';

export function parseInfo(text, fen) {
  const depth = text.match(/\bdepth (\d+)/), score = text.match(/\bscore (cp|mate) (-?\d+)/), pv = text.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+)/);
  if (!depth || !score || !pv) return null;
  return { depth: Number(depth[1]), index: Number(text.match(/\bmultipv (\d+)/)?.[1] || 1),
    kind: score[1], value: Number(score[2]) * (fen.split(' ')[1] === 'w' ? 1 : -1),
    bound: /\b(lowerbound|upperbound)\b/.test(text), moves: pv[1].trim().split(/\s+/) };
}
export function scoreText(line) {
  if (line.kind === 'mate') return `${line.value < 0 ? '−' : '+'}M${Math.abs(line.value)}`;
  return `${line.value >= 0 ? '+' : '−'}${(Math.abs(line.value) / 100).toFixed(2)}`;
}
export class StockfishClient {
  constructor(onStatus, onLine) { this.onStatus = onStatus; this.onLine = onLine; this.generation = 0; }
  async start(keep = false) {
    if (this.worker || this.loading) return;
    this.loading = true; const generation = ++this.generation;
    this.abort = new AbortController();
    this.onStatus('Downloading Stockfish 19 Lite · 1.9 MB…');
    try {
      const response = await fetch(new URL('stockfish.json', import.meta.url), { signal: this.abort.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Stockfish configuration unavailable');
      const config = await response.json(), asset = config.wasm;
      let cache;
      if (keep && self.caches) { try { cache = await caches.open(CACHE_NAME); } catch {} }
      let saved = cache && await cache.match(asset.url);
      const download = saved || await fetch(asset.url, { signal: this.abort.signal, cache: 'no-store', credentials: 'omit' });
      if (!download.ok) throw new Error(`Stockfish download: HTTP ${download.status}`);
      const bytes = await download.arrayBuffer();
      if (bytes.byteLength !== asset.bytes || await sha256(new Uint8Array(bytes)) !== asset.sha256) {
        if (cache) await cache.delete(asset.url);
        throw new Error('Stockfish integrity check failed');
      }
      if (generation !== this.generation) return;
      if (cache && !saved) await cache.put(asset.url, new Response(bytes, { headers: { 'Content-Type': 'application/wasm' } })).catch(() => {});
      if (generation !== this.generation) return;
      this.url = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
      // Upstream's hash argument selects the WASM URL. Glue stays unmodified;
      // the engine only sees a local Blob after our size/hash verification.
      this.worker = new Worker(new URL(config.loader, import.meta.url).href + '#' + encodeURIComponent(this.url));
      this.worker.onmessage = ({ data }) => { if (generation === this.generation) this.message(String(data)); };
      this.worker.onerror = event => { if (generation === this.generation) this.fail(event.message || 'Stockfish stopped'); };
      this.timer = setTimeout(() => this.fail('Stockfish startup timed out. Retry analysis.'), 30000);
      this.worker.postMessage('uci'); this.onStatus('Preparing Stockfish…');
    } catch (error) { if (generation === this.generation) this.fail(error.message); }
  }
  message(text) {
    if (text === 'uciok') {
      this.worker.postMessage('setoption name Hash value 16');
      this.worker.postMessage('setoption name MultiPV value 2'); this.worker.postMessage('isready');
    } else if (text === 'readyok' && !this.ready) {
      clearTimeout(this.timer); this.ready = true; this.loading = false; this.onStatus('Stockfish 19 Lite · ready'); this.drain();
    } else if (text.startsWith('info ') && this.current && this.latest?.id === this.current.id) {
      const line = parseInfo(text, this.current.fen);
      if (line) this.onLine({ ...line, id: this.current.id, fen: this.current.fen });
    } else if (text.startsWith('bestmove')) {
      clearTimeout(this.timer); const finished = this.current; this.current = null;
      if (finished?.id === this.latest?.id) { this.latest = null; this.onStatus('Stockfish 19 Lite · search complete'); }
      this.drain();
    }
  }
  analyze(fen, id, keep) {
    this.latest = { fen, id };
    if (!this.worker && !this.loading) this.start(keep);
    if (this.current) this.worker.postMessage('stop');
    else this.drain();
  }
  drain() {
    if (!this.ready || this.current || !this.latest) return;
    this.current = this.latest; this.onStatus('Stockfish 19 Lite · analysing…');
    this.worker.postMessage('position fen ' + this.current.fen);
    this.worker.postMessage('go depth 12 movetime 600');
    this.timer = setTimeout(() => this.fail('Stockfish search timed out. Retry analysis.'), 10000);
  }
  pause() { this.latest = null; if (this.current) this.worker.postMessage('stop'); }
  fail(message) { this.stop(); this.onStatus(`Stockfish unavailable: ${message}`); }
  stop() {
    this.generation++; this.abort?.abort(); clearTimeout(this.timer); this.worker?.terminate();
    this.worker = null; this.ready = false; this.loading = false; this.current = null; this.latest = null;
    if (this.url) URL.revokeObjectURL(this.url); this.url = null;
  }
}
