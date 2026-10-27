// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { CACHE_NAME } from './core.mjs';
const $ = id => document.getElementById(id);
let worker, config, fixtures, currentReport, visibilityChanges = [];
document.addEventListener('visibilitychange', () => {
  if (worker) visibilityChanges.push({ at: new Date().toISOString(), state: document.visibilityState });
});
function status(message, detail = '') { $('status').textContent = message; $('detail').textContent = detail; }
function busy(value) {
  for (const id of ['start', 'backend', 'iterations', 'keep', 'device-note', 'clear']) $(id).disabled = value;
  $('stop').disabled = !value;
}
function showReport(report) {
  currentReport = report;
  $('raw').textContent = JSON.stringify(report, null, 2);
  $('export').disabled = false;
  $('metrics').replaceChildren();
  if (report.status !== 'completed') {
    $('result-summary').textContent = report.status === 'cancelled' ? 'Stopped. This is not a completed performance result.' : `Test failed at ${report.lastStage}: ${report.error}`;
    return;
  }
  const backend = report.runtime.backendRequested === 'webgpu' ? 'WebGPU requested (CPU node fallback may occur)' : 'WebAssembly CPU';
  const interrupted = report.visibilityChanges?.some(change => change.state !== 'visible');
  $('result-summary').textContent = `All ${report.checks.length} reference checks passed. ${report.statistics.count} warmed inferences. ${backend}.${interrupted ? ' Tab was hidden during this run; repeat in the foreground for comparable timings.' : ''}`;
  const entries = [['Warm median', report.statistics.medianMs], ['Warm p95', report.statistics.p95Ms], ['First inference', report.firstInferenceMs], ['Session creation', report.sessionCreationMs]];
  for (const [label, value] of entries) {
    const item = document.createElement('div'); item.className = 'metric';
    const term = document.createElement('dt'); term.textContent = label;
    const result = document.createElement('dd'); result.textContent = `${value.toFixed(1)} ms`;
    item.append(term, result); $('metrics').append(item);
  }
}
function device() {
  return { note: $('device-note').value.trim(), userAgent: navigator.userAgent, logicalCores: navigator.hardwareConcurrency ?? null,
    approximateDeviceMemoryGiB: navigator.deviceMemory ?? null, crossOriginIsolated: self.crossOriginIsolated,
    webgpuAdvertised: Boolean(navigator.gpu), viewport: { width: innerWidth, height: innerHeight },
    memoryNote: 'Device memory is an approximate browser capability if provided, not measured runtime/GPU memory.' };
}
$('controls').addEventListener('submit', event => {
  event.preventDefault();
  if (!config || worker) return;
  const context = device();
  visibilityChanges = [{ at: new Date().toISOString(), state: document.visibilityState }];
  busy(true); $('export').disabled = true; $('metrics').replaceChildren(); $('result-summary').textContent = 'Test in progress…';
  $('progress').value = 0; $('progress').max = 1;
  worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  const activeWorker = worker;
  worker.onmessage = ({ data }) => {
    if (worker !== activeWorker) return;
    if (data.type === 'progress') {
      status(data.message, data.stage === 'download' || data.stage === 'verify' ? `${((data.loaded || 0) / 1e6).toFixed(1)} / ${((data.total || 0) / 1e6).toFixed(1)} MB` : '');
      if (data.total) { $('progress').max = data.total; $('progress').value = data.loaded; }
      else $('progress').removeAttribute('value');
    } else if (data.type === 'result') {
      const report = { ...data.report, device: context, page: location.href, visibilityChanges };
      worker.terminate(); worker = null; busy(false); showReport(report);
      $('progress').max = 1; $('progress').value = report.status === 'completed' ? 1 : 0;
      status(report.status === 'completed' ? 'Test complete. You can save the results or try the other backend.' : 'The test could not complete. Error details are included in the result.');
    }
  };
  worker.onerror = event => {
    if (worker !== activeWorker) return;
    worker.terminate(); worker = null; busy(false);
    showReport({ schema: 1, status: 'failed', lastStage: $('status').textContent, error: event.message || 'Worker stopped unexpectedly. The browser may have run out of resources.', device: context });
    status('Worker stopped. Try the CPU backend, or close other resource-heavy tabs.');
  };
  worker.postMessage({ config, fixtures, backend: $('backend').value, iterations: Number($('iterations').value), keep: $('keep').checked });
});
$('stop').addEventListener('click', () => {
  worker?.terminate(); worker = null; busy(false);
  showReport({ schema: 1, status: 'cancelled', lastStage: $('status').textContent, device: device(), finishedAt: new Date().toISOString() });
  status('Stopped. Saved downloads, if completed, can be cleared below.'); $('progress').value = 0;
});
$('clear').addEventListener('click', async () => {
  try { if (self.caches) await caches.delete(CACHE_NAME); status('Saved prototype downloads cleared.'); }
  catch (error) { status(`Cache clearing failed: ${error.message}`); }
});
$('export').addEventListener('click', () => {
  if (!currentReport) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(currentReport, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `mobile-maia-${currentReport.runtime?.backendRequested || currentReport.status}-${Date.now()}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
  [config, fixtures] = await Promise.all([fetch('config.json').then(r => { if (!r.ok) throw new Error('Config unavailable'); return r.json(); }), fetch('fixtures.json').then(r => { if (!r.ok) throw new Error('References unavailable'); return r.json(); })]);
  if (!self.isSecureContext || !self.Worker || !self.WebAssembly || !self.crypto?.subtle || !self.BigInt64Array) throw new Error('This browser lacks a required secure browser, worker, WebAssembly or BigInt capability.');
  $('start').disabled = false;
  status('Ready. Downloads begin only when you start; saved files will be reused.', `WebGPU ${navigator.gpu ? 'advertised' : 'not advertised'} · ${navigator.hardwareConcurrency ?? '?'} logical cores · ${self.crossOriginIsolated ? 'isolated' : 'single-thread host'}`);
} catch (error) { status(`Cannot prepare this test: ${error.message}`); }
