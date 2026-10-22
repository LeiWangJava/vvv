from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1] / 'skills' / 'vvv' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import vvv_image as images


class ImageWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name).resolve()
        (self.project / 'public').mkdir()
        (self.project / 'vvv.json').write_text('{"version":"0.1"}')
        self.request = {'version': '0.1', 'id': 'flower', 'operation': 'generate',
                        'prompt': 'One blue flower sticker', 'background': 'transparent',
                        'format': 'png', 'size': 'auto', 'references': []}
        self.source = self.project / 'source.png'
        fixture = Image.new('RGBA', (40, 20), (50, 100, 200, 0))
        fixture.paste((50, 100, 200, 255), (10, 5, 30, 15))
        fixture.save(self.source)

    def prepare(self, request=None):
        return images.prepare(self.project, request or self.request)

    def adopt(self, project, request, source):
        plan = images.plan(project, request, provider='native', native_available=True)
        return images.adopt(project, request, source, plan['plan'])

    def test_native_plan_and_adopt_work_in_a_project_without_a_manifest(self):
        project = self.project / 'custom-wedding-video'
        (project / 'assets').mkdir(parents=True)
        reference = project / 'assets' / 'bouquet.png'
        before = self.source.read_bytes()
        reference.write_bytes(before)
        request = dict(self.request, references=[{'path': 'assets/bouquet.png', 'role': 'style'}])

        plan = images.plan(project, request, provider='native', native_available=True)
        self.assertEqual(plan['status'], 'native_tool_required')
        self.assertEqual(plan['tool_arguments']['referenced_image_paths'], [str(reference)])
        self.assertTrue((project / plan['plan']).is_relative_to(project / 'creative' / 'image-plans'))
        self.assertTrue((project / plan['plan']).is_file())
        self.assertFalse((project / 'public').exists())

        result = images.adopt(project, request, self.source, plan['plan'])
        self.assertEqual(result['status'], 'generated')
        self.assertEqual(result['provider'], 'native')
        output = project / 'public' / result['asset']['file']
        self.assertTrue(output.is_relative_to(project / 'public' / 'generated'))
        with Image.open(output) as image:
            self.assertEqual(image.format, 'PNG')
            self.assertEqual(image.size, (40, 20))
            self.assertEqual(image.getpixel((0, 0)), (50, 100, 200, 0))
            self.assertEqual(image.getpixel((20, 10)), (50, 100, 200, 255))
        record_path = project / result['record']
        self.assertTrue(record_path.is_relative_to(project / 'creative' / 'image-jobs'))
        record = json.loads(record_path.read_text())
        self.assertEqual(record['status'], 'generated')
        self.assertEqual(record['provider']['plan'], plan['plan'])
        self.assertEqual(record['references'][0]['path'], 'assets/bouquet.png')
        self.assertEqual(record['asset']['sha256'], images.digest(output))
        self.assertEqual((project / record['raw']['file']).read_bytes(), before)
        self.assertEqual(reference.read_bytes(), before)
        self.assertEqual(self.source.read_bytes(), before)
        self.assertFalse((project / 'vvv.json').exists())

    @patch('vvv_image.c2c.probe', return_value={'available': False, 'reason': 'not_logged_in'})
    def test_doctor_accepts_a_manifestless_project_without_creating_files(self, probe):
        project = self.project / 'custom-wedding-video'
        project.mkdir()
        result = images.doctor(project, native_available=True)
        self.assertEqual(result['status'], 'diagnosed')
        self.assertEqual(result['configured_provider'], 'auto')
        self.assertTrue(result['native']['available'])
        self.assertFalse(result['c2c']['available'])
        self.assertEqual(result['c2c']['reason'], 'not_logged_in')
        self.assertFalse(result['api']['network_checked'])
        self.assertEqual(list(project.iterdir()), [])

    def test_project_must_be_an_existing_directory(self):
        for project in (self.project / 'missing-project', self.source):
            with self.subTest(project=project):
                with self.assertRaises(images.ImageError) as ctx:
                    images.plan(project, self.request, provider='native', native_available=True)
                self.assertEqual(ctx.exception.code, 'invalid_project')
        self.assertFalse((self.project / 'missing-project').exists())

    def test_present_manifest_is_validated_even_for_a_custom_project(self):
        manifest = self.project / 'vvv.json'
        for content, code in ((b'{"version":"9.9"}', 'invalid_project'),
                              (b'{}', 'invalid_project'),
                              (b'{not json', 'bad_request'),
                              (b'[]', 'bad_request'),
                              (b'\xff', 'bad_request')):
            with self.subTest(content=content):
                manifest.write_bytes(content)
                with self.assertRaises(images.ImageError) as ctx:
                    images.plan(self.project, self.request, provider='native', native_available=True)
                self.assertEqual(ctx.exception.code, code)
                self.assertFalse((self.project / 'creative').exists())
        manifest.unlink()
        manifest.mkdir()
        with self.assertRaises(images.ImageError) as ctx:
            images.plan(self.project, self.request, provider='native', native_available=True)
        self.assertEqual(ctx.exception.code, 'invalid_project')
        self.assertFalse((self.project / 'creative').exists())

    def test_manifest_symlinks_are_rejected_including_broken_links(self):
        manifest = self.project / 'vvv.json'
        manifest.unlink()
        valid = self.project / 'manifest.json'
        valid.write_text('{"version":"0.1"}')
        for target in (valid, self.project / 'missing-manifest.json'):
            with self.subTest(target=target):
                manifest.symlink_to(target)
                try:
                    with self.assertRaises(images.ImageError) as ctx:
                        images.plan(self.project, self.request, provider='native', native_available=True)
                    self.assertEqual(ctx.exception.code, 'unsafe_path')
                    self.assertFalse((self.project / 'creative').exists())
                finally:
                    manifest.unlink()

    def test_manifestless_projects_reject_symlinks_at_each_output_boundary(self):
        for index, relative in enumerate(('public', 'public/generated', 'creative',
                                           'creative/image-jobs', 'creative/image-plans')):
            with self.subTest(relative=relative):
                project = self.project / ('unsafe-output-' + str(index))
                project.mkdir()
                target = project / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to(self.project / 'public', target_is_directory=True)
                with self.assertRaises(images.ImageError) as ctx:
                    images.plan(project, self.request, provider='native', native_available=True)
                self.assertEqual(ctx.exception.code, 'unsafe_path')
        self.assertEqual(list((self.project / 'public').iterdir()), [])

    def test_manifestless_projects_keep_reference_paths_inside_the_project(self):
        project = self.project / 'custom-wedding-video'
        project.mkdir()
        (project / 'linked-assets').symlink_to(self.project, target_is_directory=True)
        for relative in ('../source.png', str(self.source), 'linked-assets/source.png'):
            with self.subTest(relative=relative):
                request = dict(self.request, references=[{'path': relative, 'role': 'style'}])
                with self.assertRaises(images.ImageError) as ctx:
                    images.plan(project, request, provider='native', native_available=True)
                self.assertEqual(ctx.exception.code, 'unsafe_path')
        self.assertFalse((project / 'creative').exists())

    def test_native_plan_has_real_tool_arguments_and_no_generation(self):
        result = images.plan(self.project, self.request, native_available=True)
        self.assertEqual(result['provider'], 'native')
        self.assertTrue(result['tool_arguments']['transparent_background'])
        self.assertNotIn('referenced_image_paths', result['tool_arguments'])
        self.assertTrue((self.project / result['plan']).is_file())
        self.assertFalse((self.project / 'creative' / 'image-jobs').exists())

    def test_local_reference_roles_order_and_hashes_are_preserved(self):
        request = deepcopy(self.request)
        request['operation'] = 'edit'
        request['references'] = [{'path': 'source.png', 'role': 'edit-target', 'note': 'Keep shape'}]
        result = images.plan(self.project, request, native_available=True)
        self.assertEqual(result['tool_arguments']['referenced_image_paths'], [str(self.source)])
        self.assertIn('edit-target', result['tool_arguments']['prompt'])
        self.assertEqual(result['references'][0]['sha256'], images.digest(self.source))

    def test_invalid_edit_and_reference_paths_fail_before_provider(self):
        request = deepcopy(self.request)
        request['operation'] = 'edit'
        with self.assertRaisesRegex(images.ImageError, 'edit-target'):
            self.prepare(request)
        for name in ('../outside.png', '/etc/passwd', 'x\\y.png'):
            request['references'] = [{'path': name, 'role': 'edit-target'}]
            with self.assertRaises(images.ImageError):
                self.prepare(request)

    def test_reference_symlink_and_non_image_are_rejected(self):
        link = self.project / 'link.png'
        link.symlink_to(self.source)
        for name in ('link.png', 'vvv.json'):
            request = deepcopy(self.request)
            request['references'] = [{'path': name, 'role': 'style'}]
            with self.assertRaises(images.ImageError):
                self.prepare(request)

    def test_request_rejects_unknown_fields_bad_size_and_transparent_jpeg(self):
        for update in ({'secret': 'bad'}, {'size': '0x20'}, {'size': '100000x100000'},
                       {'format': 'jpeg'}, {'id': '../escape'}, {'prompt': ''}):
            request = dict(self.request, **update)
            with self.assertRaises(images.ImageError):
                self.prepare(request)

    def test_adopt_preserves_source_and_writes_real_asset_record(self):
        before = self.source.read_bytes()
        result = self.adopt(self.project, self.request, self.source)
        self.assertEqual(self.source.read_bytes(), before)
        asset = result['asset']
        self.assertEqual((asset['width'], asset['height']), (40, 20))
        self.assertTrue(asset['has_transparency'])
        self.assertTrue((self.project / 'public' / asset['file']).is_file())
        record = json.loads((self.project / result['record']).read_text())
        self.assertEqual(record['visualReview'], 'not-reviewed')
        self.assertEqual(record['provider']['provider'], 'native')
        self.assertEqual(record['asset']['sha256'], images.digest(self.project / 'public' / asset['file']))
        self.assertTrue((self.project / record['raw']['file']).is_file())

    def test_repeated_adopt_never_overwrites_a_prior_asset(self):
        a = self.adopt(self.project, self.request, self.source)
        b = self.adopt(self.project, self.request, self.source)
        self.assertNotEqual(a['asset']['file'], b['asset']['file'])

    def test_fake_transparency_is_a_failed_job_with_raw_preserved(self):
        Image.new('RGBA', (20, 20), (0, 0, 0, 255)).save(self.source)
        with self.assertRaises(images.ImageError) as ctx:
            self.adopt(self.project, self.request, self.source)
        self.assertEqual(ctx.exception.code, 'background_mismatch')
        record = json.loads((self.project / ctx.exception.record).read_text())
        self.assertEqual(record['status'], 'failed')
        self.assertTrue((self.project / record['raw']['file']).exists())
        self.assertFalse((self.project / 'public' / 'generated').exists())

    def test_empty_transparent_image_is_rejected(self):
        Image.new('RGBA', (20, 20), (0, 0, 0, 0)).save(self.source)
        with self.assertRaises(images.ImageError) as ctx:
            self.adopt(self.project, self.request, self.source)
        self.assertEqual(ctx.exception.code, 'empty_output')

    def test_auto_edit_preserves_existing_transparency(self):
        request = dict(self.request, operation='edit', background='auto',
                       references=[{'path': 'source.png', 'role': 'edit-target'}])
        result = images.plan(self.project, request, native_available=True)
        self.assertTrue(result['tool_arguments']['transparent_background'])

    def test_size_mismatch_is_not_silently_cropped(self):
        request = dict(self.request, size='20x20')
        with self.assertRaisesRegex(images.ImageError, 'dimensions'):
            self.adopt(self.project, request, self.source)

    def test_native_size_recovery_replans_resize_and_reuses_the_original_source(self):
        request = dict(self.request, size='20x20')
        source_bytes = self.source.read_bytes()
        plan = images.plan(self.project, request, provider='native', native_available=True)
        receipt = self.project / plan['plan']
        receipt_bytes = receipt.read_bytes()
        with self.assertRaises(images.ImageError) as mismatch:
            images.adopt(self.project, request, self.source, plan['plan'])
        self.assertEqual(mismatch.exception.code, 'dimensions_mismatch')
        failed_path = self.project / mismatch.exception.record
        failed_bytes = failed_path.read_bytes()
        failed_record = json.loads(failed_bytes)
        self.assertEqual(failed_record['status'], 'failed')
        self.assertEqual((self.project / failed_record['raw']['file']).read_bytes(), source_bytes)

        resized_request = dict(request, resize='contain')
        with self.assertRaises(images.ImageError) as changed:
            images.adopt(self.project, resized_request, self.source, plan['plan'])
        self.assertEqual(changed.exception.code, 'inputs_changed')

        resized_plan = images.plan(self.project, resized_request, provider='native', native_available=True)
        result = images.adopt(self.project, resized_request, self.source, resized_plan['plan'])
        self.assertEqual(result['status'], 'generated')
        self.assertNotEqual(resized_plan['plan'], plan['plan'])
        self.assertEqual((result['asset']['width'], result['asset']['height']), (20, 20))
        record = json.loads((self.project / result['record']).read_text())
        self.assertEqual(record['provider']['plan'], resized_plan['plan'])
        self.assertIn('resize-contain', record['processing'])
        self.assertEqual((self.project / record['raw']['file']).read_bytes(), source_bytes)
        with Image.open(self.project / 'public' / result['asset']['file']) as output:
            self.assertEqual(output.size, (20, 20))
            self.assertGreater(output.getpixel((10, 10))[3], 0)
            self.assertEqual(output.getpixel((0, 0))[3], 0)
        self.assertEqual(self.source.read_bytes(), source_bytes)
        self.assertEqual(receipt.read_bytes(), receipt_bytes)
        self.assertEqual(failed_path.read_bytes(), failed_bytes)

    def test_explicit_contain_resize_records_processing(self):
        request = dict(self.request, size='20x20', resize='contain')
        result = self.adopt(self.project, request, self.source)
        self.assertEqual((result['asset']['width'], result['asset']['height']), (20, 20))
        record = json.loads((self.project / result['record']).read_text())
        self.assertIn('resize-contain', record['processing'])

    def test_output_parent_symlink_fails_before_generation(self):
        (self.project / 'creative').symlink_to(self.project / 'public', target_is_directory=True)
        with self.assertRaises(images.ImageError):
            self.adopt(self.project, self.request, self.source)

    def test_cover_output_must_still_match_background_and_have_visible_pixels(self):
        for box in ((30, 0, 90, 40), (0, 0, 10, 40)):
            image = Image.new('RGBA', (120, 40), (0, 0, 0, 0))
            image.paste((20, 30, 40, 255), box)
            image.save(self.source)
            request = dict(self.request, size='40x40', resize='cover')
            with self.assertRaises(images.ImageError) as ctx:
                self.adopt(self.project, request, self.source)
            self.assertIn(ctx.exception.code, ('background_mismatch', 'empty_output'))

    def test_native_adopt_requires_original_plan_and_unchanged_references(self):
        with self.assertRaises(images.ImageError) as ctx:
            images.adopt(self.project, self.request, self.source)
        self.assertEqual(ctx.exception.code, 'plan_required')
        request = dict(self.request, references=[{'path': 'source.png', 'role': 'style'}])
        plan = images.plan(self.project, request, provider='native', native_available=True)
        Image.new('RGB', (40, 20), 'green').save(self.source)
        with self.assertRaises(images.ImageError) as ctx:
            images.adopt(self.project, request, self.source, plan['plan'])
        self.assertEqual(ctx.exception.code, 'inputs_changed')

    def test_native_adopt_rejects_changed_prompt(self):
        plan = images.plan(self.project, self.request, provider='native', native_available=True)
        with self.assertRaises(images.ImageError) as ctx:
            images.adopt(self.project, dict(self.request, prompt='different'), self.source, plan['plan'])
        self.assertEqual(ctx.exception.code, 'inputs_changed')

    @patch('vvv_image.c2c.probe', return_value={'available': False, 'reason': 'not_logged_in'})
    def test_auto_does_not_choose_configured_paid_api(self, probe):
        (self.project / 'vvv.image.json').write_text(json.dumps({'version': '0.1', 'provider': 'auto',
            'api': {'base_url': 'https://example.com/v1', 'model': 'image-model', 'key_env': 'VVV_TEST_KEY'}}))
        with self.assertRaises(images.ImageError) as ctx:
            images.plan(self.project, self.request)
        self.assertEqual(ctx.exception.code, 'configuration_required')

    @patch('vvv_image.c2c.probe', return_value={'available': True, 'reason': 'ready'})
    def test_c2c_selected_when_native_absent(self, probe):
        self.assertEqual(images.plan(self.project, self.request)['provider'], 'c2c')

    @patch('vvv_image.api.generate')
    @patch('vvv_image.c2c.generate', side_effect=lambda *a: (_ for _ in ()).throw(images.c2c.C2CError('quota', 'Quota reached')))
    @patch('vvv_image.c2c.probe', return_value={'available': True, 'reason': 'ready'})
    def test_failed_c2c_is_not_retried_or_routed_to_api(self, probe, bridge, api):
        with self.assertRaises(images.ImageError):
            images.generate(self.project, self.request, provider='c2c')
        self.assertEqual(bridge.call_count, 1)
        api.assert_not_called()

    @patch('vvv_image.api.generate')
    def test_explicit_api_and_native_share_output_contract(self, api):
        def fake(config, request, refs, destination):
            destination.write_bytes(self.source.read_bytes())
            return {'provider': 'api', 'model': 'test-model'}
        api.side_effect = fake
        result = images.generate(self.project, self.request, provider='api')
        self.assertEqual(result['asset']['width'], 40)
        self.assertEqual(result['provider'], 'api')


if __name__ == '__main__':
    unittest.main()
