"""Build portable archives from real, isolated Git publication candidates."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


PACKAGER = Path(__file__).resolve().parents[1] / 'scripts' / 'package-skill.py'


class SkillPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        self.write('.gitignore', '.work/\nnode_modules/\n__pycache__/\n.DS_Store\n.env*\n')
        self.write('skills/vvv/SKILL.md', '---\nname: vvv\ndescription: Make editable videos.\n---\n[Guide](references/guide.md)\n')
        self.write('skills/vvv/references/guide.md', '[Helper](../scripts/vvv.py)\n')
        self.write('skills/vvv/requirements.txt', 'Pillow==11.3.0\n')
        self.write('skills/vvv/LICENSE', 'Skill license\n')
        self.write('skills/vvv/scripts/vvv.py', '# helper\n')
        self.write('skills/vvv/scripts/vvv_image.py', '# image helper\n')
        self.write('skills/vvv/scripts/vvv_media.py', '# media helper\n')
        self.write('skills/vvv/examples/request.json', '{"prompt": "fictional demo"}\n')
        self.write('skills/vvv/agents/openai.yaml', 'interface:\n  display_name: VVV\n')
        hashes = {}
        for name, content in [('c2c_img.py', '# vendor\n'), ('LICENSE', 'Vendor license\n')]:
            self.write('skills/vvv/vendor/c2c_img/' + name, content)
            hashes[name] = hashlib.sha256(content.encode()).hexdigest()
        self.write('skills/vvv/vendor/c2c_img/UPSTREAM.json', json.dumps({
            'commit': 'a' * 40, 'version': '0.4.1', 'sha256': hashes,
        }))
        self.write('skills/vvv/scripts/vvv_image_c2c.py',
                   "UPSTREAM_COMMIT = %r\nUPSTREAM_VERSION = '0.4.1'\nUPSTREAM_SHA256 = %r\n" % ('a' * 40, hashes['c2c_img.py']))
        self.output = self.root / '.work/dist/vvv-skill.zip'

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')

    def package(self, output=None):
        return subprocess.run([sys.executable, str(PACKAGER), '--root', str(self.root),
                               '--output', str(output or self.output)], capture_output=True, text=True)

    def assertRejected(self, expected):
        result = self.package()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(expected, result.stderr)
        self.assertFalse(self.output.exists())
        if self.output.parent.exists():
            self.assertEqual(list(self.output.parent.iterdir()), [])

    def test_untracked_skill_extracts_at_archive_root_without_private_or_repository_files(self):
        for name in ('README.md', 'kits/remotion/public/photo.png', 'examples/showcase/src/index.tsx',
                     'skills/vvv/.env', 'skills/vvv/.env.local', 'skills/vvv/node_modules/local.js',
                     'skills/vvv/__pycache__/local.pyc', 'skills/vvv/.DS_Store', '.work/secret.txt'):
            self.write(name, 'must not be packaged\n')
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        metadata = json.loads(result.stdout)
        self.assertEqual(metadata['path'], str(self.output))
        self.assertEqual(metadata['sha256'], hashlib.sha256(self.output.read_bytes()).hexdigest())
        with zipfile.ZipFile(self.output) as archive:
            names = archive.namelist()
            self.assertEqual(names, sorted(names))
            self.assertEqual(metadata['file_count'], len(names))
            expected = {'SKILL.md', 'LICENSE', 'requirements.txt', 'references/guide.md',
                        'scripts/vvv.py', 'scripts/vvv_image.py', 'scripts/vvv_image_c2c.py',
                        'scripts/vvv_media.py',
                        'examples/request.json', 'agents/openai.yaml', 'vendor/c2c_img/c2c_img.py',
                        'vendor/c2c_img/LICENSE', 'vendor/c2c_img/UPSTREAM.json'}
            self.assertEqual(set(names), expected)
            destination = self.root / '.work/extracted'
            archive.extractall(destination)
            self.assertIn('name: vvv', (destination / 'SKILL.md').read_text())
            self.assertTrue((destination / 'references/guide.md').is_file())

    def test_repeated_build_is_identical_despite_source_timestamp_and_mode_changes(self):
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        first = self.package()
        self.assertEqual(first.returncode, 0, first.stderr)
        source = self.root / 'skills/vvv/scripts/vvv.py'
        os.utime(source, (1000000000, 1000000000))
        source.chmod(0o755)
        second_path = self.output.with_name('second.zip')
        second = self.package(second_path)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(self.output.read_bytes(), second_path.read_bytes())

    def test_existing_output_is_preserved(self):
        self.output.parent.mkdir(parents=True)
        self.output.write_bytes(b'existing archive')
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('exists', result.stderr)
        self.assertEqual(self.output.read_bytes(), b'existing archive')

    def test_symlink_to_even_an_in_package_file_is_rejected(self):
        (self.root / 'skills/vvv/references/alias.md').symlink_to('guide.md')
        self.assertRejected('alias.md')

    def test_force_added_credentials_are_rejected(self):
        self.write('skills/vvv/.env.local', 'TOKEN=fictional\n')
        subprocess.run(['git', '-C', str(self.root), 'add', '-f', 'skills/vvv/.env.local'], check=True)
        self.assertRejected('.env.local')

    def test_broken_skill_link_is_rejected_without_an_archive(self):
        self.write('skills/vvv/references/guide.md', '[Missing](missing.md)\n')
        self.assertRejected('missing.md')

    def test_missing_required_skill_file_is_rejected(self):
        (self.root / 'skills/vvv/LICENSE').unlink()
        self.assertRejected('LICENSE')

    def test_modified_vendor_source_is_rejected(self):
        self.write('skills/vvv/vendor/c2c_img/c2c_img.py', '# unexpected mutation\n')
        self.assertRejected('SHA-256 mismatch')


if __name__ == '__main__':
    unittest.main()
