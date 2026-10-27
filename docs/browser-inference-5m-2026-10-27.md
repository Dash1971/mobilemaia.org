# 5M default and 79M comparison — 2026-10-27

The [browser experiment](https://mobilemaia.org/lab/inference/) now defaults to
Maia-3 5M and keeps 79M selectable. Both are original, unchanged ONNX exports.
No app source, build tooling, release gate, version or publication changed;
there is no Stable/Preview companion port to make for this website-only feature.

## Model and download selection

| Model | Weights | First CPU download | First GPU download |
| --- | ---: | ---: | ---: |
| 5M, default | 21,346,652 bytes | about 36 MB | about 50 MB |
| 79M, optional | 316,034,244 bytes | about 331 MB | about 345 MB |

Totals include the unchanged pinned backend-specific ONNX Runtime Web 1.31.1
WASM binary, before HTTP compression. The UI updates the estimate for both
selectors. Selection alone downloads no weights. Each immutable model URL has
its own cache key; saved runtimes can be shared across models. JSON reports and
export filenames identify the model. Changing selections leaves previous results
labelled with the model that actually ran. The default resets to 5M on reload.

5M is the **historical research export**, not the current Android model. Its
SHA-256 is `ddae2aa893b5ca7ec94d24178871f1c337d09fd72ff38abe8d76b8ecf08cb942`.
The original Git blob at app commit
`4e80de9402f6d1944d6582d7a6ab09b8b33fe223` provides a
[direct download](https://raw.githubusercontent.com/Dash1971/maia-chess-android/4e80de9402f6d1944d6582d7a6ab09b8b33fe223/assets/models/maia3-5m.onnx).
Its public response returned HTTP 200, 21,346,652 bytes and CORS `*`; downloading
and hashing those bytes matched both the original Git object and the research
archive. No ZIP extractor, new browser runtime dependency or model copy in the
website repository is needed. The lab links the archived attribution/licence.

79M retains its original URL, SHA-256 and published native reference scores.
See the [initial baseline record](browser-inference-2026-10-27.md).
The models can make different predictions; smaller download size is not evidence
of equal playing quality or score calibration.

## Independent 5M correctness references

`tools/make_5m_reference.py` uses native ONNX Runtime **1.24.3**, single-thread CPU,
and an independently written NumPy encoder. It takes only positions, ratings,
history flags and known tensor hashes from the existing 79M fixture. It discards
the 79M expected scores and computes new 5M outputs. All eight NumPy input
tensors match their pre-existing SHA-256 hashes.

The generated `site/lab/inference/fixtures-5m.json` contains White scores, all
three value logits and selected policy logits (indices 0, 2176, 4351, and the
native maximum index). Score tolerance is 0.0005; absolute logit tolerance is
0.002. Eight checks cover before/after 26.Rd1, ratings 1600/2600, history on/off.
The browser verifies each model's fixture-file SHA-256 before enabling Start,
then checks input tensors before model download. A score or logit mismatch stops
the test. Each run still requests and reads back all three model outputs.

[Native provenance](browser-inference-5m-2026-10-27/native-reference.json) records
model, generator, fixture and source-position hashes, plus runtime versions.
[Installed wheel provenance](browser-inference-5m-2026-10-27/native-packages.json)
records official PyPI URLs and hashes. Shared NumPy 2.3.5 and packaging 26.3 were
reused; the isolated temporary venv did not modify shared dependencies.

To reproduce with Python 3.12 and a separately downloaded, hash-checked model:

```sh
python3.12 -m venv .scratch/inference-reference
.scratch/inference-reference/bin/python -m pip install -r tools/inference-reference-requirements.txt
.scratch/inference-reference/bin/python tools/make_5m_reference.py /path/to/maia3-5m.onnx
node tools/test_inference.mjs
```

The generator refuses a wrong model size/hash or native runtime version. It
writes only the 5M fixture and compact native provenance. CI checks pinned
fixtures, generator and runtime integrity without installing Python dependencies
or downloading any weights.

## Local browser verification

Mac Chrome 155 desktop, no throttling, 32 measured runs after the eight reference
inferences. These are smoke measurements, not phone results or a quality study.

| 5M backend | Warm median | Warm p95 | First inference | Session creation |
| --- | ---: | ---: | ---: | ---: |
| CPU, single-thread WASM | 49.3 ms | 66.1 ms | 165.9 ms | 1,664.4 ms |
| WebGPU requested | 29.7 ms | 35.5 ms | 163.1 ms | 3,494.5 ms |

Both passed all eight score/value/policy checks. Maximum score errors were
1.99e-7 (CPU) and 5.02e-7 (GPU); maximum sampled policy-logit errors were
1.53e-5 and 1.34e-5. GPU can use CPU nodes internally; per-node placement is not
measured. Full reports: [CPU](browser-inference-5m-2026-10-27/local-5m-cpu.json),
[WebGPU](browser-inference-5m-2026-10-27/local-5m-webgpu.json).

Model/backend switching showed 36/50/331/345 MB as expected without relabelling
old results. Stop during a 79M download returned an explicitly cancelled 79M
report. Clearing downloads succeeded; reloading selected 5M again. Desktop and
390/320px controls were visually checked, with no horizontal document overflow.
Viewport checks do not simulate phone inference performance.

The original benchmark's memory, battery, installation and lifecycle limitations
still apply. No analytics, automatic uploads, service worker or account added.

## Task storage

Initial volume free space was 63,012,970,496 bytes; budget under 1 GiB plus the
10 GiB reserve. Task-owned `.scratch/inference-5m/` held the temporary native
environment, 21 MB model and package-install report; these were removed after
public 5M verification. No app build, emulator or shared SDK change.
Compact provenance and browser reports are retained in this document's companion
directory. Task-owned preview processes and browser caches were cleared after verification;
completion details are recorded below.


## Published verification

Code commit `7ff07e2424d5f9ca4382b71d34ef3c909d943d8a` passed
[CI and Pages deployment](https://github.com/Dash1971/mobilemaia.org/actions/runs/40454969554).
A concurrent homepage/community-link update was preserved before publishing.
All [14 lab files](browser-inference-5m-2026-10-27/public-assets.json) matched local
bytes over verified HTTPS. Both model downloads and both runtime downloads were
size/hash verified in real browser runs. CPU runtime downloads were reused across
models; both the model and runtime were reused for the final 79M GPU run.

All four model/backend combinations passed all eight model-specific references.
The following are Mac Chrome desktop smoke results, **not phone benchmarks**.

| Model | Backend requested | Warm runs | Median | p95 | Full result |
| --- | --- | ---: | ---: | ---: | --- |
| 5M | cpu | 32 | 52.9 ms | 77.3 ms | [JSON](browser-inference-5m-2026-10-27/public-5m-cpu.json) |
| 5M | webgpu | 32 | 30.0 ms | 36.1 ms | [JSON](browser-inference-5m-2026-10-27/public-5m-webgpu.json) |
| 79M | cpu | 32 | 765.0 ms | 839.1 ms | [JSON](browser-inference-5m-2026-10-27/public-79m-cpu.json) |
| 79M | webgpu | 32 | 45.8 ms | 55.9 ms | [JSON](browser-inference-5m-2026-10-27/public-79m-webgpu.json) |

No hidden-tab transition was recorded in these runs. The 79M CPU result varied
substantially: a separate 8-run repeat passed with median
289.3 ms and p95 313.9 ms
([repeat JSON](browser-inference-5m-2026-10-27/public-79m-cpu-repeat.json)). This is
also slower than the earlier 79M-only smoke run. Model, input and runtime hashes
still match. System load, scheduling, power state and browser compilation caches
were not controlled, and the cause of the timing variation was not established.
These reports validate execution and routing; they do not establish a precise
model speedup or a performance regression. Repeated tests under recorded phone
conditions remain necessary. All raw timings, including outliers, are retained.

The Chrome download history confirmed the new export filename
`mobile-maia-79m-wasm-1793079051346.json`, 6.3 KB, Done. The default reset to 5M
on reload after comparison. Named download caches on both local and public
origins were cleared through the UI; the QA and download-history tabs were
closed. The preview process was already stopped. Temporary native environment,
weights and install report were removed (234,220,195 bytes); no shared tools or
existing model archives were removed. See
[cleanup evidence](browser-inference-5m-2026-10-27/cleanup.json). Only compact
source, fixtures, provenance, browser reports, screenshots and the JSON export
are intentionally retained. No task bulk output remains.
