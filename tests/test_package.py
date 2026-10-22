"""The .vvv package: packing, verification without execution, unpacking, init from a package and effects."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'skills' / 'vvv' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
from vvv_project import create_project, project_fingerprint, validate_project  # noqa: E402
import vvv_package  # noqa: E402
from vvv_package import (MIMETYPE, add_effect, dump, evidence_record, finish, pack_project, unpack,  # noqa: E402
                         verify_package, write_archive)

RULES = json.loads((ROOT / 'kits' / 'remotion' / 'package-licenses.json').read_text())['rules']


def codes(report):
    return {c['code']: c['status'] for c in report['checks']}


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.kit = self.base / 'kit'
        (self.kit / 'catalog').mkdir(parents=True)
        (self.kit / 'src').mkdir()
        (self.kit / 'public' / 'music').mkdir(parents=True)
        (self.kit / 'src' / 'index.tsx').write_text('export const source = true;\n')
        (self.kit / 'package.json').write_text('{"private":true,"dependencies":{"remotion":"4.0.534"}}\n')
        shutil.copyfile(ROOT / 'kits' / 'remotion' / 'package-licenses.json', self.kit / 'package-licenses.json')
        (self.kit / 'public' / 'music' / 'sources.json').write_text(json.dumps({'version': '0.1', 'tracks': [
            {'file': 'mixkit-song.mp3', 'distribution': 'download', 'url': 'https://example.invalid/song.mp3',
             'bytes': 4, 'sha256': hashlib.sha256(b'song').hexdigest(), 'title': 'Song', 'license': 'Mixkit'}]}))
        self.catalog = {
            'id': 'reel', 'version': '1.0.0', 'compositionId': 'VVV-Reel',
            'defaultProps': {'copy': {'title': 'Example'}, 'fps': 30, 'music': {'src': 'music/mixkit-song.mp3'}, 'photos': {}},
            'slots': {'cover': {'kind': 'single', 'count': 1}},
            'sample': {'from': 0, 'to': 2}, 'formats': {'16:9': {'width': 1920, 'height': 1080}}, 'defaultFormat': '16:9',
            'package': {'name': '@test/reel', 'license': 'MIT'},
        }
        (self.kit / 'catalog' / 'reel.json').write_text(json.dumps(self.catalog))
        self.photos = self.base / 'photos'
        self.photos.mkdir()
        Image.new('RGB', (64, 48), 'red').save(self.photos / 'a.png')

    def project(self, name='project'):
        create_project(self.kit, 'reel', [self.photos], self.base / name)
        project = self.base / name
        (project / 'public' / 'music' / 'mixkit-song.mp3').write_bytes(b'song')  # as if fetched by npm run music
        return project

    def template_package(self, name='reel.vvv'):
        """A template package built from a project tree, as pack_template would lay it out."""
        project = self.project('template-source')
        files = vvv_package.collect_dir(project)
        files.pop('public/music/mixkit-song.mp3')
        for path in [p for p in files if p.startswith('creative/') or p == 'PROJECT.md']:
            del files[path]
        files['schema/props.schema.json'] = dump({'type': 'object'})
        files['AGENTS.md'] = b'# Test package\n'
        manifest = {'vvvFormat': '1.0', 'kind': 'template', 'name': '@test/reel', 'version': '1.0.0',
                    'entry': 'src/index.tsx', 'inputs': 'inputs.json', 'assets': 'assets.json',
                    'schema': 'schema/props.schema.json',
                    'template': {'id': 'reel', 'catalog': 'catalog/reel.json', 'formats': self.catalog['formats'],
                                 'defaultFormat': '16:9', 'slots': self.catalog['slots']},
                    'downloads': [{'path': 'public/music/mixkit-song.mp3', 'url': 'https://example.invalid/song.mp3',
                                   'bytes': 4, 'sha256': hashlib.sha256(b'song').hexdigest()}]}
        finish(files, manifest, RULES, 'template')
        return Path(write_archive(files, self.base / name)['path']), project

    def rewrite(self, package, change):
        """Copy a package entry by entry, letting `change(name, data)` return new data, None to drop, or a list."""
        output = package.with_name('changed.vvv')
        with zipfile.ZipFile(package) as source, zipfile.ZipFile(output, 'w') as target:
            for info in source.infolist():
                result = change(info.filename, source.read(info))
                for name, data in (result if isinstance(result, list) else [(info.filename, result)]):
                    if data is not None:
                        target.writestr(zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0)), data)
        return output

    def restricted_project_package(self):
        """Build a structurally valid project package with a forbidden download-only file."""
        project = self.project('restricted-project')
        base = self.base / 'restricted-base.vvv'
        pack_project(project, base)
        with zipfile.ZipFile(base) as archive:
            files = {info.filename: archive.read(info) for info in archive.infolist()}
        forbidden = 'public/music/mixkit-evil.mp3'
        files[forbidden] = b'evil'
        licenses = json.loads(files['licenses.json'])
        licenses['files'][forbidden] = 'mixkit-download-only'
        files['licenses.json'] = dump(licenses)
        integrity = json.loads(files['integrity.json'])
        integrity['files']['licenses.json'] = {'bytes': len(files['licenses.json']),
                                               'sha256': hashlib.sha256(files['licenses.json']).hexdigest()}
        integrity['files'][forbidden] = {'bytes': len(files[forbidden]), 'sha256': hashlib.sha256(files[forbidden]).hexdigest()}
        files['integrity.json'] = dump(integrity)
        output = self.base / 'restricted.vvv'
        write_archive(files, output)
        return output

    def test_project_round_trip_is_deterministic_and_leaves_out_download_only_music(self):
        project = self.project()
        first = pack_project(project, self.base / 'a.vvv')
        second = pack_project(project, self.base / 'b.vvv')
        self.assertEqual(first['sha256'], second['sha256'])
        self.assertIn("owner's photos", first['warning'])
        report = verify_package(self.base / 'a.vvv')
        self.assertEqual(report['status'], 'passed', report)
        with zipfile.ZipFile(self.base / 'a.vvv') as archive:
            names = archive.namelist()
            self.assertEqual(names[0], 'mimetype')
            self.assertEqual(archive.getinfo('mimetype').compress_type, zipfile.ZIP_STORED)
            self.assertEqual(archive.read('mimetype'), MIMETYPE.encode())
            manifest = json.loads(archive.read('vvv.json'))
        self.assertNotIn('public/music/mixkit-song.mp3', names)
        self.assertEqual([d['path'] for d in manifest['downloads']], ['public/music/mixkit-song.mp3'])
        self.assertIn('AGENTS.md', names)
        unpacked = unpack(self.base / 'a.vvv', self.base / 'unpacked')
        self.assertEqual(unpacked['status'], 'unpacked')
        (self.base / 'unpacked' / 'public' / 'music' / 'mixkit-song.mp3').write_bytes(b'song')
        # The package's computed fingerprint is the unpacked project's, once downloads are fetched.
        self.assertEqual(report['package']['fingerprint'], project_fingerprint(self.base / 'unpacked'))
        self.assertEqual(project_fingerprint(project), project_fingerprint(self.base / 'unpacked'))

    def test_project_instructions_survive_pack_unpack_and_repack(self):
        project = self.project()
        generated = (project / 'AGENTS.md').read_text()
        self.assertIn('vvv:generated:begin', generated)
        note = '\n## Production constraints\n\n- Keep the vertical cut under 30 seconds.\n- The couple approved the warm grade.\n'
        (project / 'AGENTS.md').write_text('# Lin and Xu film\n\n' + generated + note)
        pack_project(project, self.base / 'a.vvv')
        self.assertEqual(verify_package(self.base / 'a.vvv')['status'], 'passed')
        unpack(self.base / 'a.vvv', self.base / 'next')
        carried = (self.base / 'next' / 'AGENTS.md').read_text()
        self.assertTrue(carried.startswith('# Lin and Xu film\n\n<!-- vvv:generated:begin'))
        self.assertTrue(carried.endswith(note))
        self.assertEqual(carried.count('vvv:generated:begin'), 1)
        # The next agent hands it on again: one generated block, the same instructions.
        pack_project(self.base / 'next', self.base / 'b.vvv')
        unpack(self.base / 'b.vvv', self.base / 'again')
        self.assertEqual((self.base / 'again' / 'AGENTS.md').read_text(), carried)

    def test_unmarked_project_instructions_are_kept_whole(self):
        project = self.project()
        (project / 'AGENTS.md').write_text('Only use the photos the couple picked.\n')
        pack_project(project, self.base / 'a.vvv')
        with zipfile.ZipFile(self.base / 'a.vvv') as archive:
            agents = archive.read('AGENTS.md').decode()
        self.assertIn('vvv:generated:end', agents)
        self.assertTrue(agents.endswith('## Project instructions\n\nOnly use the photos the couple picked.\n'))

    def test_strip_media_leaves_out_owner_photos_and_says_so(self):
        project = self.project()
        result = pack_project(project, self.base / 'stripped.vvv', strip_media=True)
        self.assertGreater(result['strippedMedia'], 0)
        with zipfile.ZipFile(self.base / 'stripped.vvv') as archive:
            self.assertFalse([n for n in archive.namelist() if n.startswith('public/photos/')])
            manifest = json.loads(archive.read('vvv.json'))
            agents = archive.read('AGENTS.md').decode()
        self.assertTrue(manifest['strippedMedia'])
        self.assertIn('Media were left out', agents)
        self.assertIsNone(result['warning'])

    def test_pack_project_rejects_linked_out_directory(self):
        project = self.project('linked-out-project')
        external = self.base / 'external-out'
        external.mkdir()
        (external / 'private.report.json').write_text('{"fingerprint":"external"}\n')
        (project / 'out').symlink_to(external, target_is_directory=True)
        output = self.base / 'linked-out.vvv'
        with self.assertRaisesRegex(ValueError, r'PACK_SYMLINK: out'):
            pack_project(project, output)
        self.assertFalse(output.exists())

    def test_pack_project_rejects_linked_render_report(self):
        project = self.project('linked-report-project')
        out = project / 'out'
        out.mkdir()
        external = self.base / 'private.report.json'
        external.write_text('{"fingerprint":"external"}\n')
        (out / 'sample.report.json').symlink_to(external)
        output = self.base / 'linked-report.vvv'
        with self.assertRaisesRegex(ValueError, r'PACK_SYMLINK: out/sample\.report\.json'):
            pack_project(project, output)
        self.assertFalse(output.exists())

    def test_tampering_unsafe_paths_and_bad_containers_fail_verification(self):
        package, _ = self.template_package()
        self.assertEqual(verify_package(package)['status'], 'passed')
        cases = {
            'INTEGRITY': lambda n, d: d + b'//' if n == 'src/index.tsx' else d,
            'MIMETYPE': lambda n, d: None if n == 'mimetype' else d,
            'PATHS': lambda n, d: [(n, d), ('../escape.txt', b'x')] if n == 'vvv.json' else d,
            'CONTENTS': lambda n, d: [(n, d), ('public/music/mixkit-song.mp3', b'song')] if n == 'vvv.json' else d,
        }
        for code, change in cases.items():
            with self.subTest(code=code):
                changed = self.rewrite(package, change)
                report = verify_package(changed)
                self.assertEqual(report['status'], 'failed')
                self.assertEqual(codes(report)[code], 'failed')
                changed.unlink()
        with self.assertRaisesRegex(ValueError, 'PACKAGE_INVALID'):
            unpack(self.rewrite(package, cases['INTEGRITY']), self.base / 'never')
        self.assertFalse((self.base / 'never').exists())

    def test_malformed_metadata_returns_structured_failures(self):
        package, _ = self.template_package()
        cases = [
            ('integrity.json', dump([]), 'INTEGRITY'),
            ('integrity.json', dump({'files': {'src/index.tsx': []}}), 'INTEGRITY'),
            ('licenses.json', dump([]), 'LICENSES'),
        ]
        for filename, data, code in cases:
            with self.subTest(filename=filename, code=code):
                changed = self.rewrite(package, lambda n, old: data if n == filename else old)
                report = verify_package(changed)
                self.assertEqual(report['status'], 'failed', report)
                self.assertEqual(codes(report)[code], 'failed')
                changed.unlink()

        licenses = json.loads(zipfile.ZipFile(package).read('licenses.json'))
        licenses['files']['outside.txt'] = licenses['rules'][0]['id']
        changed = self.rewrite(package, lambda n, old: dump(licenses) if n == 'licenses.json' else old)
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['LICENSES'], 'failed')

        manifest = json.loads(zipfile.ZipFile(package).read('vvv.json'))
        manifest['template'] = 'malformed'
        changed = self.rewrite(package, lambda n, old: dump(manifest) if n == 'vvv.json' else old)
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['CONTENTS'], 'failed')

        manifest['kind'] = 'effect'
        manifest['name'] = '@test/effect'
        manifest['effect'] = 'malformed'
        changed = self.rewrite(package, lambda n, old: dump(manifest) if n == 'vvv.json' else old)
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['CONTENTS'], 'failed')

        changed = self.rewrite(
            package,
            lambda n, old: [(n, old), ('check/bad.json', dump({'inputs': {'props': []}, 'check': []}))]
            if n == 'vvv.json' else old,
        )
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['EVIDENCE'], 'warning')

    def test_manifest_schema_validates_nested_types_formats_and_conditionals(self):
        package, _ = self.template_package()
        self.assertEqual(codes(verify_package(package))['MANIFEST_SCHEMA'], 'passed')
        cases = {
            'runtime-engine': lambda manifest: manifest.update(runtime={'engine': 'other'}),
            'download-url': lambda manifest: manifest['downloads'][0].update(url='not a uri'),
            'malformed-url': lambda manifest: manifest['downloads'][0].update(url='https://[bad'),
            'unsafe-path': lambda manifest: manifest.update(entry='../src/index.tsx'),
            'format-width': lambda manifest: manifest['template']['formats']['16:9'].update(width='1920'),
            'missing-template-schema': lambda manifest: manifest.pop('schema'),
        }
        with zipfile.ZipFile(package) as archive:
            original = json.loads(archive.read('vvv.json'))
        for name, mutate in cases.items():
            with self.subTest(name=name):
                manifest = json.loads(json.dumps(original))
                mutate(manifest)
                changed = self.rewrite(package, lambda n, old: dump(manifest) if n == 'vvv.json' else old)
                report = verify_package(changed)
                self.assertEqual(report['status'], 'failed', report)
                self.assertEqual(codes(report)['MANIFEST_SCHEMA'], 'failed', report)
                changed.unlink()

    def test_required_agents_entry_is_verified(self):
        package, _ = self.template_package()
        changed = self.rewrite(package, lambda n, data: None if n == 'AGENTS.md' else data)
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['LAYOUT'], 'failed')

        changed = self.rewrite(
            package,
            lambda n, data: [(n, data), ('src/index.tsx/child', b'x')] if n == 'vvv.json' else data,
        )
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['PATHS'], 'failed')

    def test_corrupt_zip_members_return_failed_reports(self):
        package, _ = self.template_package()
        raw = bytearray(package.read_bytes())
        target = b'src/index.tsx'
        local = raw.find(b'PK\x03\x04' + b'\x14\x00')
        while local >= 0:
            name_length = int.from_bytes(raw[local + 26:local + 28], 'little')
            extra_length = int.from_bytes(raw[local + 28:local + 30], 'little')
            name = bytes(raw[local + 30:local + 30 + name_length])
            if name == target:
                start = local + 30 + name_length + extra_length
                raw[start] ^= 0xFF
                break
            local = raw.find(b'PK\x03\x04' + b'\x14\x00', local + 1)
        else:
            self.fail('test package did not contain the target member')
        changed = self.base / 'corrupt-member.vvv'
        changed.write_bytes(raw)
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['INTEGRITY'], 'failed')

        raw = bytearray(package.read_bytes())
        marker = b'application/vnd.vvv+zip'
        offset = raw.find(marker)
        self.assertGreaterEqual(offset, 0)
        raw[offset] ^= 0x01
        changed = self.base / 'corrupt-mimetype.vvv'
        changed.write_bytes(raw)
        report = verify_package(changed)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['MIMETYPE'], 'failed')

    def test_project_packages_cannot_redistribute_download_only_media(self):
        package = self.restricted_project_package()
        report = verify_package(package)
        self.assertEqual(report['status'], 'failed', report)
        self.assertEqual(codes(report)['LICENSES'], 'failed')

    def test_symlink_entries_are_rejected(self):
        package, _ = self.template_package()
        output = self.base / 'link.vvv'
        with zipfile.ZipFile(package) as source, zipfile.ZipFile(output, 'w') as target:
            for info in source.infolist():
                target.writestr(info, source.read(info))
            link = zipfile.ZipInfo('src/link.tsx')
            link.external_attr = (0o120777) << 16
            target.writestr(link, '/etc/passwd')
        self.assertEqual(codes(verify_package(output))['PATHS'], 'failed')

    def test_template_packages_refuse_unlicensed_and_owner_material(self):
        files = {'src/index.tsx': b'x', 'inputs.json': b'{}', 'assets.json': b'{}', 'notes.bin': b'?'}
        with self.assertRaisesRegex(ValueError, 'PACK_LICENSE.*notes.bin: no license rule'):
            finish(dict(files), {'vvvFormat': '1.0', 'kind': 'template'}, RULES, 'template')
        owner = {**files, 'creative/brief.md': b'x'}
        owner.pop('notes.bin')
        with self.assertRaisesRegex(ValueError, 'PACK_LICENSE.*creative/brief.md'):  # owner notes have no template rule
            finish(owner, {'vvvFormat': '1.0', 'kind': 'template'}, RULES, 'template')
        mixkit = {**files, 'public/music/mixkit-x.mp3': b'x'}
        mixkit.pop('notes.bin')
        with self.assertRaisesRegex(ValueError, 'forbids redistribution'):
            finish(mixkit, {'vvvFormat': '1.0', 'kind': 'project'}, RULES, 'project')

    def test_init_from_a_template_package_replaces_demo_inputs(self):
        package, _ = self.template_package()
        Image.new('RGB', (40, 60), 'blue').save(self.photos / 'b.png')
        result = create_project(None, str(package), [self.photos / 'b.png'], self.base / 'mine')
        self.assertEqual(result['template'], 'reel')
        mine = self.base / 'mine'
        manifest = json.loads((mine / 'vvv.json').read_text())
        self.assertEqual(manifest['kind'], 'project')
        self.assertEqual(manifest['template']['from'], '@test/reel@1.0.0')
        assets = json.loads((mine / 'assets.json').read_text())['items']
        self.assertEqual(len(assets), 1)
        self.assertEqual(sorted(p.name for p in (mine / 'public' / 'photos').iterdir()), [Path(assets[0]['file']).name])
        for leftover in ('integrity.json', 'licenses.json', 'check', 'preview'):
            self.assertFalse((mine / leftover).exists(), leftover)
        self.assertIn('VVV project', (mine / 'AGENTS.md').read_text())
        self.assertNotEqual(validate_project(mine)['status'], 'failed')
        with self.assertRaisesRegex(ValueError, 'PACKAGE_KIND'):
            pack_project(mine, self.base / 'mine.vvv')
            create_project(None, str(self.base / 'mine.vvv'), [self.photos], self.base / 'again')

    def test_template_packages_describe_themselves_and_initialize_their_example(self):
        from vvv_project import describe_template
        package, source = self.template_package()
        record = describe_template(None, str(package))
        self.assertEqual((record['id'], record['fixture'], record['music']['src']), ('reel', 'inputs.json', 'music/mixkit-song.mp3'))
        self.assertEqual(record['slots'], [{'name': 'cover', 'kind': 'single'}])
        self.assertTrue(all(f'--template {package}' in n for n in record['next']))
        create_project(None, str(package), [], self.base / 'demo', example=True)
        demo = self.base / 'demo'
        self.assertEqual(json.loads((demo / 'inputs.json').read_text())['props']['photos'],
                         json.loads((source / 'inputs.json').read_text())['props']['photos'])
        self.assertEqual(len(list((demo / 'public' / 'photos').rglob('*.jpg'))), 1)
        self.assertNotEqual(validate_project(demo)['status'], 'failed')
        self.assertFalse((demo / 'licenses.json').exists())

    def test_package_agent_notes_name_the_package_records(self):
        project = self.project()
        pack_project(project, self.base / 'a.vvv')
        with zipfile.ZipFile(self.base / 'a.vvv') as archive:
            agents = archive.read('AGENTS.md').decode()
        self.assertIn('# project\n', agents)
        self.assertIn('licenses.json', agents)
        self.assertIn('vvv.json "downloads"', agents)

    def test_evidence_is_current_for_the_packaged_files_and_any_format_but_not_after_edits(self):
        package, project = self.template_package()
        unpacked = self.base / 'measured'
        unpack(package, unpacked)
        (unpacked / 'public' / 'music' / 'mixkit-song.mp3').write_bytes(b'song')
        check = {'status': 'passed', 'checks': [{'code': 'STILL', 'status': 'passed', 'stillShare': 0.2}]}
        record = evidence_record(unpacked, check)
        inputs = json.loads((unpacked / 'inputs.json').read_text())
        inputs['props']['format'] = '9:16'
        (unpacked / 'inputs.json').write_text(json.dumps(inputs, ensure_ascii=False, indent=2) + '\n')
        vertical = evidence_record(unpacked, check)
        inputs['props']['copy']['title'] = 'Edited'
        (unpacked / 'inputs.json').write_text(json.dumps(inputs, ensure_ascii=False, indent=2) + '\n')
        edited = evidence_record(unpacked, check)
        with zipfile.ZipFile(package) as archive:
            files = {i.filename: archive.read(i) for i in archive.infolist()}
        manifest = json.loads(files.pop('vvv.json'))
        for name in ('mimetype', 'integrity.json', 'licenses.json'):
            files.pop(name)
        files.update({'check/a.json': dump(record), 'check/b.json': dump(vertical), 'check/c.json': dump(edited)})
        finish(files, manifest, RULES, 'template')
        with_evidence = Path(write_archive(files, self.base / 'evidence.vvv')['path'])
        report = verify_package(with_evidence)
        current = {e['file']: e['current'] for e in report['package']['evidence']}
        self.assertEqual(current, {'check/a.json': True, 'check/b.json': True, 'check/c.json': False})
        self.assertEqual(codes(report)['EVIDENCE'], 'warning')
        self.assertEqual(report['status'], 'passed')

    def effect_package(self, index=b'import { Halo } from "../../components/Halo";\nexport const Glow = Halo;\n'):
        files = {
            'src/index.tsx': b'export {};\n', 'inputs.json': dump({'template': 'glow', 'props': {}}),
            'assets.json': dump({'version': '0.1', 'items': []}),
            'catalog/glow.json': dump({'id': 'glow', 'formats': {'16:9': {'width': 1920, 'height': 1080}}}),
            'src/effects/glow/index.tsx': index, 'src/effects/glow/demo.tsx': b'import "../../core/demo-only";\n',
            'src/effects/glow/README.md': b'# Glow\n', 'src/components/Halo.tsx': b'export const Halo = () => null;\n',
            'public/assets/glow/spark.png': b'png', 'schema/props.schema.json': dump({}),
            'AGENTS.md': b'# Test effect\n',
        }
        manifest = {'vvvFormat': '1.0', 'kind': 'effect', 'name': '@test/glow', 'version': '1.2.0',
                    'entry': 'src/index.tsx', 'inputs': 'inputs.json', 'assets': 'assets.json',
                    'schema': 'schema/props.schema.json',
                    'template': {'id': 'glow', 'catalog': 'catalog/glow.json', 'formats': {'16:9': {'width': 1920, 'height': 1080}}},
                    'effect': {'id': 'glow', 'source': 'src/effects/glow/', 'exports': ['Glow'],
                               'public': ['public/assets/glow/spark.png'], 'fonts': []}}
        finish(files, manifest, RULES, 'effect')
        return Path(write_archive(files, self.base / f'glow-{len(index)}.vvv')['path'])

    def test_add_effect_copies_the_component_its_code_and_assets_but_not_the_demo(self):
        project = self.project()
        package = self.effect_package()
        self.assertEqual(verify_package(package)['status'], 'passed')
        result = add_effect(project, package)
        self.assertEqual(sorted(result['added']), ['public/assets/glow/spark.png', 'src/components/Halo.tsx',
                                                   'src/effects/glow/README.md', 'src/effects/glow/index.tsx'])
        self.assertFalse((project / 'src/effects/glow/demo.tsx').exists())
        self.assertEqual(json.loads((project / 'vvv.json').read_text())['effects'],
                         [{'id': 'glow', 'name': '@test/glow', 'version': '1.2.0', 'source': 'src/effects/glow/'}])
        self.assertEqual(add_effect(project, package)['added'], [])
        different = self.effect_package(b'export const Glow = 1;\n')
        with self.assertRaisesRegex(ValueError, 'EFFECT_EXISTS'):
            add_effect(project, different)

    def test_manifests_follow_the_published_schema(self):
        """Representative package manifests retain the published schema's key constraints."""
        import re
        schema = json.loads((ROOT / 'skills/vvv/schema/vvv-1.0.schema.json').read_text())

        def check(manifest):
            required = list(schema['required'])
            for rule in schema['allOf']:
                condition = rule['if']['properties']['kind']
                if manifest['kind'] in condition.get('enum', [condition.get('const')]):
                    required += rule['then']['required']
            self.assertFalse([k for k in required if k not in manifest], manifest.get('kind'))
            for key, spec in schema['properties'].items():
                if key not in manifest:
                    continue
                if 'const' in spec:
                    self.assertEqual(manifest[key], spec['const'], key)
                if 'enum' in spec:
                    self.assertIn(manifest[key], spec['enum'], key)
                if 'pattern' in spec:
                    self.assertRegex(manifest[key], spec['pattern'], key)
            for item in manifest.get('downloads', []):
                self.assertRegex(item['sha256'], '^[0-9a-f]{64}$')

        template, project = self.template_package()
        pack_project(project, self.base / 'project.vvv')
        for package in (template, self.base / 'project.vvv', self.effect_package()):
            with zipfile.ZipFile(package) as archive:
                check(json.loads(archive.read('vvv.json')))
        check(json.loads((project / 'vvv.json').read_text()))

    @unittest.skipUnless(shutil.which('node') and (ROOT / 'kits/remotion/node_modules/typescript').is_dir(),
                         'Packing from the kit reads its code with Node and the kit dependencies.')
    def test_kit_effect_packs_with_only_what_it_needs(self):
        output = self.base / 'papercut-frame.vvv'
        result = subprocess.run([sys.executable, str(SCRIPTS / 'vvv.py'), 'pack', '--kit', str(ROOT / 'kits/remotion'),
                                 '--effect', 'papercut-frame', '--output', str(output)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = verify_package(output)
        self.assertEqual(report['status'], 'passed', report)
        with zipfile.ZipFile(output) as archive:
            names = archive.namelist()
            manifest = json.loads(archive.read('vvv.json'))
            registry = archive.read('src/templates/registry.ts').decode()
        self.assertEqual(manifest['kind'], 'effect')
        self.assertEqual(manifest['effect']['fonts'], [])
        self.assertTrue(all(p.startswith('public/assets/xy39/') for p in manifest['effect']['public']))
        self.assertFalse([n for n in names if n.startswith(('src/templates/album', 'src/templates/comedy', 'public/fonts/files'))])
        self.assertIn("'papercut-frame'", registry)
        self.assertNotIn('album', registry)
        wrong = subprocess.run([sys.executable, str(SCRIPTS / 'vvv.py'), 'pack', '--kit', str(ROOT / 'kits/remotion'),
                                '--template', 'papercut-frame', '--output', str(self.base / 'wrong.vvv')],
                               capture_output=True, text=True)
        self.assertNotEqual(wrong.returncode, 0)
        self.assertIn('PACK_KIND', wrong.stdout)


if __name__ == '__main__':
    unittest.main()
