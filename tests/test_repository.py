"""Publication checks run against real, isolated Git repositories."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


CHECKER = Path(__file__).resolve().parents[1] / 'scripts' / 'check-repository.py'


class RepositoryChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        for name in ('README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
                     'CONTRIBUTING.md', 'SECURITY.md', 'requirements.txt'):
            self.write(name, 'Public fixture\n')
        self.write('.gitignore', 'ignored/\n.work/\n')
        self.write('skills/vvv/SKILL.md', '---\nname: vvv\ndescription: Make editable videos.\n---\n\n[Guide](references/guide.md)\n')
        self.write('skills/vvv/references/guide.md', '[Helper](../scripts/vvv.py)\n')
        self.write('skills/vvv/requirements.txt', 'Pillow==11.3.0\n')
        self.write('skills/vvv/LICENSE', 'Skill license\n')
        self.write('skills/vvv/scripts/vvv.py', '# helper\n')
        self.write('skills/vvv/scripts/vvv_image.py', '# image helper\n')
        self.write('skills/vvv/scripts/vvv_media.py', '# media helper\n')
        self.write('kits/remotion/package.json', '{}\n')
        self.write('kits/remotion/package-lock.json', '{}\n')
        hashes = {}
        for name, content in [('c2c_img.py', '# vendor\n'), ('LICENSE', 'Vendor license\n')]:
            self.write('skills/vvv/vendor/c2c_img/' + name, content)
            hashes[name] = hashlib.sha256(content.encode()).hexdigest()
        self.write('skills/vvv/vendor/c2c_img/UPSTREAM.json', json.dumps({
            'commit': 'a' * 40, 'version': '0.4.1', 'sha256': hashes,
        }))
        self.write('skills/vvv/scripts/vvv_image_c2c.py',
                   "UPSTREAM_COMMIT = %r\nUPSTREAM_VERSION = '0.4.1'\nUPSTREAM_SHA256 = %r\n" % ('a' * 40, hashes['c2c_img.py']))

    def write(self, name, content):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')

    def check(self, *arguments):
        return subprocess.run([sys.executable, str(CHECKER), '--root', str(self.root), *arguments],
                              capture_output=True, text=True)

    def assertRejected(self, path):
        result = self.check()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(path, result.stdout + result.stderr)

    def test_client_folders_are_rejected_at_any_depth(self):
        self.write('kits/remotion/public/Customer/couple/p1.jpg', 'photo')
        self.assertRejected('Customer/couple/p1.jpg')

    def test_download_only_music_is_rejected_but_beat_maps_are_allowed(self):
        self.write('kits/remotion/public/music/mixkit-skyline.beats.json', '{}')
        self.assertEqual(self.check().returncode, 0)
        self.write('kits/remotion/public/music/mixkit-skyline.mp3', 'audio')
        self.assertRejected('mixkit-skyline.mp3')

    def test_private_terms_file_rejects_names_without_printing_them(self):
        self.write('.gitignore', 'ignored/\n.work/\n.private-terms\n')
        self.write('.private-terms', '# local only\nZhang Example\n')
        self.write('docs/note.md', 'Thanks to zhang example for the photos.\n')
        result = self.check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('docs/note.md', result.stderr)
        self.assertNotIn('zhang example', (result.stdout + result.stderr).lower())
        self.write('docs/note.md', 'Thanks to a fictional couple.\n')
        self.assertEqual(self.check().returncode, 0, self.check().stderr)

    def test_untracked_publication_candidate_passes_without_a_commit(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_tracked_publication_candidate_passes(self):
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_missing_document_link_is_rejected(self):
        self.write('README.md', '[Install](docs/missing.md)\n')
        self.assertRejected('docs/missing.md')

    def test_ignored_local_file_cannot_satisfy_a_public_link(self):
        self.write('ignored/guide.md', 'Available only on the author machine\n')
        self.write('README.md', '[Guide](ignored/guide.md)\n')
        self.assertRejected('ignored/guide.md')

    def test_reference_image_and_html_source_are_checked(self):
        for content in ('![Preview][shot]\n\n[shot]: docs/missing.png\n',
                        '<img src="docs/missing.png" alt="Preview">\n'):
            with self.subTest(content=content):
                self.write('README.md', content)
                self.assertRejected('docs/missing.png')

    def test_fragments_queries_encoded_spaces_and_external_links_are_accepted(self):
        self.write('docs/guide with spaces.md', '# Setup\n')
        self.write('README.md', '[Setup](docs/guide%20with%20spaces.md?raw=1#setup)\n'
                   '[Remote](https://example.com/absent) [Email](mailto:example@example.com)\n'
                   '[Top](#top)\n```md\n[Example](not-a-real-file.md)\n```\n')
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_skill_reference_cannot_escape_the_installed_folder(self):
        self.write('skills/vvv/references/guide.md', '[Repository readme](../../../README.md)\n')
        self.assertRejected('../../../README.md')

    def test_skill_symlink_cannot_import_a_repository_file(self):
        (self.root / 'skills/vvv/references/borrowed.md').symlink_to('../../../README.md')
        self.assertRejected('borrowed.md')

    def test_private_work_directories_are_rejected_if_not_ignored(self):
        self.write('docs/research/private.md', 'Private research\n')
        self.assertRejected('docs/research/private.md')

    def test_force_added_private_file_is_rejected_despite_gitignore(self):
        self.write('.work/private.txt', 'Private notes\n')
        subprocess.run(['git', '-C', str(self.root), 'add', '-f', '.work/private.txt'], check=True)
        self.assertRejected('.work/private.txt')

    def test_generated_kit_build_cannot_be_published(self):
        self.write('kits/remotion/build/index.js', '// generated bundle\n')
        self.assertRejected('kits/remotion/build/index.js')

    def test_ignored_private_files_do_not_block_publication(self):
        self.write('.work/private.txt', 'Private notes\n')
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_required_root_file_must_be_in_publication_candidate(self):
        (self.root / 'LICENSE').unlink()
        self.assertRejected('LICENSE')

    def test_skill_frontmatter_requires_the_expected_name_and_description(self):
        for header in ('name: other\ndescription: Valid description.', 'name: vvv\ndescription: ""'):
            with self.subTest(header=header):
                self.write('skills/vvv/SKILL.md', '---\n' + header + '\n---\n')
                self.assertRejected('SKILL.md')

    def test_vendor_source_mutation_is_rejected(self):
        self.write('skills/vvv/vendor/c2c_img/c2c_img.py', '# changed unexpectedly\n')
        self.assertRejected('c2c_img.py')

    def test_adapter_pin_must_match_the_vendor_manifest(self):
        self.write('skills/vvv/scripts/vvv_image_c2c.py', "UPSTREAM_SHA256 = 'wrong'\n")
        self.assertRejected('vvv_image_c2c.py')

    def test_portable_check_runs_the_copied_skill_away_from_the_checkout(self):
        self.write('skills/vvv/scripts/vvv.py',
                   'from pathlib import Path\n'
                   'assert Path(__file__).resolve().parents[1] != Path(%r)\n'
                   'assert (Path(__file__).resolve().parents[1] / "requirements.txt").is_file()\n'
                   % str(self.root / 'skills/vvv'))
        adapter = self.root / 'skills/vvv/scripts/vvv_image_c2c.py'
        adapter.write_text(adapter.read_text() + '\ndef _load_upstream():\n    return None\n')
        result = self.check('--portable')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_portable_check_exposes_an_ignored_runtime_dependency(self):
        self.write('.gitignore', 'skills/vvv/scripts/local_only.py\n')
        self.write('skills/vvv/scripts/local_only.py', 'VALUE = 1\n')
        self.write('skills/vvv/scripts/vvv.py', 'import local_only\n')
        result = self.check('--portable')
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn('local_only', result.stderr)


if __name__ == '__main__':
    unittest.main()
