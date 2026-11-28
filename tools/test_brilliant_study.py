"""Offline checks for the isolated, immutable study importer."""
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import brilliant_study as study


class StudyImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for name, value in [('ROOT', root), ('SNAPSHOT', root / 'research-source/brilliant-study'),
                            ('SITE', root / 'site/research/brilliant-moves')]:
            patcher = patch.object(study, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.data = b'{"title":"Recorded study"}\n'
        self.row = {'source': 'web/index-card.json',
                    'target': 'research-source/brilliant-study/index-card.json',
                    'bytes': len(self.data), 'sha256': hashlib.sha256(self.data).hexdigest()}

    def import_rows(self, rows, payload=None):
        responses = [io.BytesIO(json.dumps({'files': rows}).encode()),
                     io.BytesIO(self.data if payload is None else payload)]
        with patch.object(study, 'urlopen', side_effect=responses):
            study.update('a' * 40)

    def test_valid_import_is_checked_and_tampering_is_rejected(self):
        self.import_rows([self.row])
        self.assertEqual(study.manifest()['commit'], 'a' * 40)
        (study.ROOT / self.row['target']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'asset changed'):
            study.manifest()

    def test_bad_hash_leaves_existing_files_unchanged(self):
        target = study.ROOT / self.row['target']
        target.parent.mkdir(parents=True)
        target.write_bytes(b'previous')
        with self.assertRaisesRegex(ValueError, 'bytes do not match'):
            self.import_rows([self.row], b'wrong')
        self.assertEqual(target.read_bytes(), b'previous')
        self.assertFalse((study.SNAPSHOT / 'manifest.json').exists())

    def test_unrelated_targets_and_mutable_refs_are_rejected(self):
        for target in ['site/main.js', '../outside.json']:
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, 'may not change'):
                self.import_rows([{**self.row, 'target': target}])
        with self.assertRaisesRegex(ValueError, 'full immutable'):
            study.update('main')


if __name__ == '__main__':
    unittest.main()
