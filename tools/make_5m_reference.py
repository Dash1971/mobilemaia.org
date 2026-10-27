#!/usr/bin/env python3
"""Generate independent CPU references; needs numpy and onnxruntime 1.24.3.

Run with a verified historical 5M model. Never downloads or changes weights.
The existing 79M fixtures supply positions/ratings, not expected 5M outputs.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
MODEL_SHA = 'ddae2aa893b5ca7ec94d24178871f1c337d09fd72ff38abe8d76b8ecf08cb942'


def tokens(fens, history):
    # Independent NumPy implementation of the app's historical board encoding.
    frames = fens[-8:] if history else [fens[-1]]
    frames = [frames[0]] * (8 - len(frames)) + frames
    result = np.zeros((1, 64, 97), dtype='<f4')
    for frame, fen in enumerate(frames):
        placement, side = fen.split()[:2]
        for row, rank in enumerate(placement.split('/')):
            col = 0
            for char in rank:
                if char.isdigit():
                    col += int(char)
                else:
                    square = (row if side == 'b' else 7 - row) * 8 + col
                    own = char.isupper() == (side == 'w')
                    channel = frame * 12 + 'pnbrqk'.index(char.lower()) + (0 if own else 6)
                    result[0, square, channel] = 1
                    col += 1
            assert col == 8
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    args = parser.parse_args()
    assert ort.__version__ == '1.24.3', 'Use the pinned native runtime'
    assert args.model.stat().st_size == 21346652
    with args.model.open('rb') as stream:
        assert hashlib.file_digest(stream, 'sha256').hexdigest() == MODEL_SHA
    source = ROOT / 'site/lab/inference/fixtures.json'
    fixtures = json.loads(source.read_text())
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(args.model), sess_options=options, providers=['CPUExecutionProvider'])
    rows = []
    for original in fixtures:
        row = {k: v for k, v in original.items() if k not in ('whiteScore', 'referenceWhiteScore')}
        encoded = tokens(row['historyFens'], row['history'])
        assert hashlib.sha256(encoded.tobytes()).hexdigest() == row['tokensSha256']
        rating = np.array([row['elo']], dtype=np.int64)
        outputs = dict(zip([o.name for o in session.get_outputs()], session.run(None, {
            'tokens': encoded, 'self_elo': rating, 'opponent_elo': rating,
        })))
        assert all(np.isfinite(o).all() for o in outputs.values())
        logits = outputs['value_logits'].reshape(3).astype(np.float64)
        exp = np.exp(logits - logits.max())
        probs = exp / exp.sum()
        stm = float(probs[2] + .5 * probs[1])
        row['whiteScore'] = stm if row['historyFens'][-1].split()[1] == 'w' else 1 - stm
        row['referenceWhiteScore'] = row['whiteScore']
        row['nativeValueLogits'] = logits.tolist()
        policy = outputs['move_logits'].reshape(4352)
        indices = sorted(set([0, 2176, 4351, int(policy.argmax())]))
        row['nativePolicySamples'] = [{'index': i, 'logit': float(policy[i])} for i in indices]
        rows.append(row)
    destination = ROOT / 'site/lab/inference/fixtures-5m.json'
    destination.write_text(json.dumps(rows, indent=2) + '\n')
    provenance = {
        'modelSha256': MODEL_SHA, 'runtime': {'name': 'onnxruntime', 'version': ort.__version__,
            'provider': 'CPUExecutionProvider', 'numpyVersion': np.__version__, 'threads': 1},
        'positionSource': {'path': 'site/lab/inference/fixtures.json',
            'sha256': hashlib.sha256(source.read_bytes()).hexdigest()},
        'generator': {'path': 'tools/make_5m_reference.py',
            'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        'fixturesSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'inputNames': [i.name for i in session.get_inputs()],
        'outputNames': [o.name for o in session.get_outputs()],
        'checks': len(rows),
    }
    out = ROOT / 'docs/browser-inference-5m-2026-10-27'
    out.mkdir(exist_ok=True)
    (out / 'native-reference.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print('PASS: independent native 5M outputs for', len(rows), 'input tensors')


if __name__ == '__main__':
    main()
