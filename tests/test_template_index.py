import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class TemplateIndexTests(unittest.TestCase):
    def test_committed_index_matches_the_catalogs(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'export-template-index.py'), '--check'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_index_lists_every_template_with_photo_needs_and_previews(self):
        index = json.loads((ROOT / 'kits' / 'remotion' / 'index.json').read_text(encoding='utf-8'))
        catalogs = sorted(p.stem for p in (ROOT / 'kits' / 'remotion' / 'catalog').glob('*.json'))
        self.assertEqual(sorted(t['id'] for t in index['templates'] + index['effects']), catalogs)
        for template in index['templates']:
            with self.subTest(template=template['id']):
                self.assertTrue(template['formats'] and all('minPhotos' in f for f in template['formats']))
                self.assertEqual(sorted(template['slotsByFormat']), sorted(f['name'] for f in template['formats']))
                for preview in template['previews']:
                    self.assertTrue(preview['video'].startswith('https://vibevision.video/media/'))


if __name__ == '__main__':
    unittest.main()
