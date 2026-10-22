"""Offline media behavior tests; real FFmpeg integration skips if not configured."""
import array
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import wave

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'skills' / 'vvv' / 'scripts' / 'vvv_media.py'


def cli(project, *arguments, binaries=None, env=None):
    command = [sys.executable, str(SCRIPT), arguments[0], '--project', str(project)]
    if binaries:
        command += ['--ffmpeg', binaries[0], '--ffprobe', binaries[1]]
    process = subprocess.run(command + list(arguments[1:]), capture_output=True, text=True,
                             env=env, timeout=90)
    try:
        result = json.loads(process.stdout)
    except json.JSONDecodeError as error:
        raise AssertionError('CLI did not return JSON: ' + process.stderr) from error
    return process.returncode, result


def ffmpeg_env(executable):
    env = os.environ.copy()
    if sys.platform == 'darwin':
        env['DYLD_LIBRARY_PATH'] = str(Path(executable).parent)
    return env


class MediaCLIValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name).resolve() / '项目 空间'
        self.project.mkdir()
        self.source = self.project / '原始 资料.mp4'
        self.source.write_bytes(b'not a real movie')

    def assert_error(self, arguments, code, **kwargs):
        status, result = cli(self.project, *arguments, **kwargs)
        self.assertNotEqual(status, 0)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error']['code'], code)
        return result

    def test_missing_source_and_url_are_not_passed_to_tools(self):
        for source in ('https://example.com/video.mp4', 'file:///tmp/movie.mp4', 'pipe:0'):
            self.assert_error(('probe', '--source', source), 'source_not_local')
        self.assert_error(('probe', '--source', str(self.project / 'missing.mp4')), 'source_missing')
        self.assert_error(('probe', '--source', str(self.project)), 'source_not_file')

    def test_symlink_source_and_symlink_parent_are_rejected(self):
        link = self.project / 'link.mp4'
        link.symlink_to(self.source)
        self.assert_error(('probe', '--source', str(link)), 'source_symlink')
        directory = self.project / 'alias'
        directory.symlink_to(self.project, target_is_directory=True)
        self.assert_error(('probe', '--source', str(directory / self.source.name)), 'source_symlink')
        self.assert_error(('probe', '--source', str(directory / '..' / self.source.name)), 'source_symlink')

    def test_non_finite_negative_and_reversed_times_fail_before_media_access(self):
        for start, end in (('nan', '1'), ('0', 'inf'), ('-1', '1'), ('1', '1'), ('2', '1')):
            self.assert_error(('clip', '--source', str(self.source), '--from', start, '--to', end),
                              'invalid_time')
        self.assert_error(('frames', '--source', str(self.source), '--at', 'nan'), 'invalid_time')
        self.assert_error(('audio', '--source', str(self.source), '--audio-stream', '-1'),
                          'invalid_stream')

    def test_more_than_24_frame_requests_fail_without_work(self):
        args = ['frames', '--source', str(self.source)]
        for index in range(25):
            args += ['--at', str(index / 10)]
        self.assert_error(tuple(args), 'too_many_frames')
        self.assertFalse((self.project / 'public' / 'derived').exists())

    def test_explicit_missing_binary_is_not_silently_replaced(self):
        result = self.assert_error(('probe', '--source', str(self.source)), 'tool_missing',
                                  binaries=(str(self.project / 'missing-ffmpeg'),
                                            str(self.project / 'missing-ffprobe')))
        self.assertIn('ffprobe', result['error']['message'])

    def test_argparse_errors_are_json(self):
        self.assert_error(('frames', '--source', str(self.source)), 'invalid_arguments')

    def test_missing_project_is_rejected_without_creating_it(self):
        missing = self.project / 'not-created'
        status, result = cli(missing, 'doctor')
        self.assertNotEqual(status, 0)
        self.assertEqual(result['error']['code'], 'project_missing')
        self.assertFalse(missing.exists())

    @unittest.skipUnless(sys.platform == 'darwin', 'macOS system path aliases only')
    def test_macos_tmp_system_alias_is_allowed_but_user_symlinks_are_not(self):
        with tempfile.TemporaryDirectory(dir='/tmp') as directory:
            source = Path(directory) / 'normal.mp4'
            source.write_bytes(b'local source')
            self.assert_error(('probe', '--source', str(source)), 'tool_missing',
                              binaries=(str(self.project / 'no-ffmpeg'), str(self.project / 'no-ffprobe')))


class ToolDiscoveryTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('vvv_media_discovery', SCRIPT)
        self.media = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.media)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name)

    def install(self, package, name):
        folder = self.project / 'node_modules' / '@remotion' / package
        folder.mkdir(parents=True)
        (folder / name).write_bytes(b'#!/bin/sh\n')
        (folder / name).chmod(0o755)
        return folder / name

    def test_compositor_packages_are_found_on_every_platform(self):
        for system, machine, package, name in [('Darwin', 'arm64', 'compositor-darwin-arm64', 'ffmpeg'),
                                               ('Darwin', 'x86_64', 'compositor-darwin-x64', 'ffmpeg'),
                                               ('Linux', 'x86_64', 'compositor-linux-x64-gnu', 'ffprobe'),
                                               ('Linux', 'aarch64', 'compositor-linux-arm64-musl', 'ffmpeg'),
                                               ('Windows', 'AMD64', 'compositor-win32-x64-msvc', 'ffmpeg.exe')]:
            with self.subTest(package=package):
                expected = self.install(package, name)
                with patch.object(self.media.platform, 'system', return_value=system), \
                        patch.object(self.media.platform, 'machine', return_value=machine), \
                        patch.object(self.media.shutil, 'which', return_value=None):
                    found = self.media.find_tool(name.split('.')[0], None, self.project)
                self.assertEqual(found, str(expected.resolve()))
                shutil.rmtree(expected.parent)

    def test_compositor_libraries_are_on_the_loader_path(self):
        binary = self.install('compositor-linux-x64-gnu', 'ffmpeg')
        for platform_name, variable in [('linux', 'LD_LIBRARY_PATH'), ('darwin', 'DYLD_LIBRARY_PATH')]:
            with self.subTest(platform=platform_name), patch.object(self.media.sys, 'platform', platform_name):
                env = self.media.library_env(binary, {variable: '/existing'})
                self.assertEqual(env[variable], str(binary.parent) + os.pathsep + '/existing')
        with patch.object(self.media.sys, 'platform', 'linux'):
            self.assertNotIn('LD_LIBRARY_PATH', self.media.library_env('/usr/bin/ffmpeg', {}))
        with patch.object(self.media.sys, 'platform', 'win32'):
            self.assertEqual(self.media.library_env(binary, {}), {})


class MediaIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ffmpeg = os.environ.get('VVV_TEST_FFMPEG') or shutil.which('ffmpeg')
        cls.ffprobe = os.environ.get('VVV_TEST_FFPROBE') or shutil.which('ffprobe')
        if not cls.ffmpeg or not cls.ffprobe:
            raise unittest.SkipTest('Real media integration requires FFmpeg/ffprobe on PATH or '
                                    'VVV_TEST_FFMPEG and VVV_TEST_FFPROBE.')
        cls.ffmpeg, cls.ffprobe = str(Path(cls.ffmpeg).resolve()), str(Path(cls.ffprobe).resolve())
        cls.env = ffmpeg_env(cls.ffmpeg)
        cls.fixture_temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.fixture_temp.cleanup)
        cls.fixtures = Path(cls.fixture_temp.name).resolve()
        # 24 independently authored RGB frames, 2 seconds at 12 fps. No lavfi required.
        for frame in range(24):
            Image.new('RGB', (96, 64), '#e03232' if frame < 12 else '#254fde').save(
                cls.fixtures / ('frame-%03d.png' % frame))
        for name, frequency in (('low', 220), ('high', 880)):
            values = array.array('h', (int(10000 * math.sin(2 * math.pi * frequency * n / 48000))
                                      for n in range(96000)))
            if sys.byteorder != 'little':
                values.byteswap()
            with wave.open(str(cls.fixtures / (name + '.wav')), 'wb') as output:
                output.setparams((1, 2, 48000, 0, 'NONE', 'not compressed'))
                output.writeframes(values.tobytes())
        cls.silent = cls.fixtures / 'silent.mp4'
        cls.multi = cls.fixtures / 'multi.mp4'
        cls.run_ffmpeg('-framerate', '12', '-i', str(cls.fixtures / 'frame-%03d.png'),
                       '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-aspect', '3:2', '-an', str(cls.silent))
        cls.run_ffmpeg('-i', str(cls.silent), '-i', str(cls.fixtures / 'low.wav'), '-i',
                       str(cls.fixtures / 'high.wav'), '-map', '0:v:0', '-map', '1:a:0',
                       '-map', '2:a:0', '-c:v', 'copy', '-c:a', 'aac', str(cls.multi))

    @classmethod
    def run_ffmpeg(cls, *arguments):
        subprocess.run([cls.ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
                        *arguments], env=cls.env, check=True, capture_output=True, timeout=90)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name).resolve() / '项目 空格'
        self.project.mkdir()
        self.source = self.project / '视频 空格.mp4'
        shutil.copyfile(self.multi, self.source)

    def command(self, *arguments, code=0):
        status, result = cli(self.project, *arguments, binaries=(self.ffmpeg, self.ffprobe))
        self.assertEqual(status, code, result)
        self.assertEqual(result['ok'], code == 0, result)
        return result

    def check_record(self, result, source):
        record = json.loads((self.project / result['record']).read_text())
        self.assertEqual(record['status'], 'completed')
        self.assertEqual(record['visualReview'], 'not-reviewed')
        self.assertEqual(record['source']['name'], source.name)
        self.assertEqual(record['source']['sha256'], hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertTrue(record['tools']['ffmpeg']['version'])
        for output in record['outputs']:
            file = self.project / 'public' / output['file']
            self.assertTrue(file.is_file())
            self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(), output['sha256'])
            self.assertTrue(output['metadata']['streams'])
        self.assertFalse((self.project / 'assets.json').exists())
        self.assertFalse((self.project / 'vvv.json').exists())
        return record

    def test_doctor_reports_operation_capabilities_and_binaries(self):
        result = self.command('doctor')
        for operation in ('probe', 'clip', 'audio', 'frames'):
            self.assertTrue(result['operations'][operation]['available'], result)
        self.assertIn('libx264', result['encoders'])
        self.assertIn('mp4', result['muxers'])

    def test_probe_reports_real_streams_hash_and_duration_without_creating_assets(self):
        before = self.source.read_bytes()
        result = self.command('probe', '--source', str(self.source))
        self.assertAlmostEqual(result['metadata']['durationSeconds'], 2, places=1)
        self.assertEqual([s['codec_type'] for s in result['metadata']['streams']],
                         ['video', 'audio', 'audio'])
        self.assertEqual(result['source']['sha256'], hashlib.sha256(before).hexdigest())
        self.assertEqual(self.source.read_bytes(), before)
        self.assertFalse((self.project / 'creative').exists())

    def test_clip_has_requested_span_preserves_dimensions_and_records_provenance(self):
        before = self.source.read_bytes()
        result = self.command('clip', '--source', str(self.source), '--from', '0.5', '--to', '1.5')
        record = self.check_record(result, self.source)
        output = record['outputs'][0]
        self.assertTrue(output['file'].endswith('/clip.mp4'))
        self.assertAlmostEqual(output['metadata']['durationSeconds'], 1, delta=0.15)
        video = [s for s in output['metadata']['streams'] if s['codec_type'] == 'video'][0]
        self.assertEqual((video['width'], video['height']), (96, 64))
        self.assertEqual(record['request']['from'], 0.5)
        self.assertEqual(record['request']['to'], 1.5)
        self.assertEqual(self.source.read_bytes(), before)

    def test_clip_of_silent_movie_and_mute_both_keep_no_audio(self):
        for source, flags in ((self.silent, []), (self.source, ['--mute'])):
            result = self.command('clip', '--source', str(source), '--from', '0', '--to', '1', *flags)
            record = self.check_record(result, source)
            self.assertEqual([s['codec_type'] for s in record['outputs'][0]['metadata']['streams']],
                             ['video'])

    def test_selected_audio_track_changes_actual_waveform_and_keeps_span(self):
        for track, expected_crossings in ((0, 440), (1, 1760)):
            result = self.command('audio', '--source', str(self.source), '--from', '0.25', '--to',
                                  '1.25', '--audio-stream', str(track))
            record = self.check_record(result, self.source)
            self.assertEqual(record['request']['audioStream'], track)
            with wave.open(str(self.project / 'public' / record['outputs'][0]['file']), 'rb') as audio:
                self.assertEqual((audio.getnchannels(), audio.getsampwidth()), (1, 2))
                self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 1, delta=0.01)
                values = array.array('h', audio.readframes(audio.getnframes()))
            if sys.byteorder != 'little':
                values.byteswap()
            crossings = sum(a < 0 <= b or a >= 0 > b for a, b in zip(values, values[1:]))
            self.assertAlmostEqual(crossings, expected_crossings, delta=10)

    def test_audio_without_bounds_defaults_to_whole_source(self):
        result = self.command('audio', '--source', str(self.source))
        record = self.check_record(result, self.source)
        self.assertAlmostEqual(record['outputs'][0]['metadata']['durationSeconds'], 2, delta=0.05)

    def test_frames_are_actual_requested_colors_and_keep_request_order(self):
        result = self.command('frames', '--source', str(self.source), '--at', '1.5', '--at', '0.25')
        record = self.check_record(result, self.source)
        self.assertEqual(record['request']['at'], [1.5, 0.25])
        outputs = record['outputs']
        self.assertEqual(len(outputs), 2)
        for output, color_channel in zip(outputs, (2, 0)):
            with Image.open(self.project / 'public' / output['file']) as image:
                self.assertEqual(image.size, (96, 64))
                rgb = image.convert('RGB').getpixel((40, 30))
                self.assertGreater(rgb[color_channel], 180)
                self.assertLess(rgb[1], 110)

    def test_out_of_range_and_missing_audio_fail_with_durable_record_and_no_outputs(self):
        cases = [(['clip', '--source', str(self.source), '--from', '0', '--to', '2.1'],
                  'time_out_of_range'),
                 (['frames', '--source', str(self.source), '--at', '2'], 'time_out_of_range'),
                 (['audio', '--source', str(self.silent)], 'missing_audio'),
                 (['audio', '--source', str(self.source), '--audio-stream', '2'], 'missing_audio'),
                 (['clip', '--source', str(self.source), '--from', '0', '--to', '1',
                   '--audio-stream', '3'], 'missing_audio')]
        for arguments, code in cases:
            result = self.command(*arguments, code=1)
            self.assertEqual(result['error']['code'], code)
            record = json.loads((self.project / result['record']).read_text())
            self.assertEqual(record['status'], 'failed')
            self.assertFalse(record['outputs'])
        self.assertFalse(list((self.project / 'public' / 'derived').glob('*')))

    def test_corrupted_media_is_not_published(self):
        self.source.write_bytes(b'broken movie')
        result = self.command('audio', '--source', str(self.source), code=1)
        self.assertEqual(result['error']['code'], 'invalid_media')
        record = json.loads((self.project / result['record']).read_text())
        self.assertEqual(record['status'], 'failed')
        self.assertFalse(record['outputs'])

    def test_repeated_requests_never_overwrite_previous_job(self):
        first = self.command('frames', '--source', str(self.source), '--at', '0.5')
        record = self.check_record(first, self.source)
        file = self.project / 'public' / record['outputs'][0]['file']
        before = file.read_bytes()
        second = self.command('frames', '--source', str(self.source), '--at', '0.5')
        self.assertNotEqual(first['record'], second['record'])
        self.assertEqual(before, file.read_bytes())

    def test_blocked_or_symlink_output_directory_leaves_no_partial_assets(self):
        (self.project / 'public').write_text('preserve me')
        result = self.command('frames', '--source', str(self.source), '--at', '0.5', code=1)
        self.assertEqual(result['error']['code'], 'output_unavailable')
        self.assertEqual((self.project / 'public').read_text(), 'preserve me')
        self.assertEqual(json.loads((self.project / result['record']).read_text())['status'], 'failed')
        (self.project / 'public').unlink()
        outside = self.project / 'outside'
        outside.mkdir()
        (self.project / 'public').symlink_to(outside, target_is_directory=True)
        result = self.command('frames', '--source', str(self.source), '--at', '0.5', code=1)
        self.assertEqual(result['error']['code'], 'output_unavailable')
        self.assertFalse(list(outside.iterdir()))

    def test_unknown_duration_is_reported_without_guessing_a_bound(self):
        spec = importlib.util.spec_from_file_location('vvv_media_under_test', SCRIPT)
        media = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(media)
        arguments = ['clip', '--project', str(self.project), '--ffmpeg', self.ffmpeg,
                     '--ffprobe', self.ffprobe, '--source', str(self.source), '--from', '0', '--to', '1']
        # Model a real FFprobe result with no duration, e.g. an unindexed/streaming container.
        metadata = {'durationSeconds': None, 'format': {'format_name': 'mpegts'},
                    'streams': [{'index': 0, 'codec_type': 'video', 'width': 96, 'height': 64}]}
        with patch.object(media, 'probe_media', return_value=metadata):
            result = media.execute(media.parser().parse_args(arguments))
        self.assertFalse(result['ok'])
        self.assertEqual(result['error']['code'], 'duration_unknown')
        self.assertIn('bounds', result['error']['message'])
        self.assertEqual(json.loads((self.project / result['record']).read_text())['status'], 'failed')

    def test_encoder_failure_removes_partial_file_and_records_failure(self):
        spec = importlib.util.spec_from_file_location('vvv_media_under_test', SCRIPT)
        media = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(media)
        arguments = ['frames', '--project', str(self.project), '--ffmpeg', self.ffmpeg,
                     '--ffprobe', self.ffprobe, '--source', str(self.source), '--at', '0.5']
        original_run = media.run_tool

        def disk_failure(command, **kwargs):
            if '-frames:v' in command:
                Path(command[-1]).write_bytes(b'half a PNG')
                raise media.MediaError('processing_failed', 'Synthetic disk-full interruption')
            return original_run(command, **kwargs)

        with patch.object(media, 'run_tool', side_effect=disk_failure):
            result = media.execute(media.parser().parse_args(arguments))
        self.assertFalse(result['ok'])
        self.assertEqual(result['error']['code'], 'processing_failed')
        self.assertFalse(list((self.project / 'public' / 'derived').glob('*')))
        record = json.loads((self.project / result['record']).read_text())
        self.assertEqual(record['status'], 'failed')
        self.assertFalse(list((self.project / result['record']).parent.glob('**/*.png')))

    def test_missing_encoder_is_reported_without_publishing_output(self):
        spec = importlib.util.spec_from_file_location('vvv_media_under_test', SCRIPT)
        media = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(media)
        arguments = ['frames', '--project', str(self.project), '--ffmpeg', self.ffmpeg,
                     '--ffprobe', self.ffprobe, '--source', str(self.source), '--at', '0.5']
        # A reduced FFmpeg build can exist and run while omitting PNG encoding.
        with patch.object(media, 'capabilities', return_value=({'libx264'}, {'image2'})):
            result = media.execute(media.parser().parse_args(arguments))
        self.assertFalse(result['ok'])
        self.assertEqual(result['error']['code'], 'unsupported_operation')
        self.assertIn('encoder:png', result['error']['message'])
        self.assertFalse(list((self.project / 'public' / 'derived').glob('*')))

    def test_project_remotion_binaries_are_discovered_when_path_is_empty(self):
        import platform
        host = {'Darwin': 'darwin', 'Linux': 'linux', 'Windows': 'win32'}[platform.system()]
        architecture = {'arm64': 'arm64', 'aarch64': 'arm64', 'x86_64': 'x64', 'AMD64': 'x64'}[platform.machine()]
        modules = self.project / 'node_modules' / '@remotion'
        modules.mkdir(parents=True)
        # Remotion's package names: compositor-darwin-arm64, compositor-linux-x64-gnu, compositor-win32-x64-msvc, ...
        suffix = {'linux': '-gnu', 'win32': '-msvc'}.get(host, '')
        target = modules / ('compositor-' + host + '-' + architecture + suffix)
        target.mkdir()
        for name, source in (('ffmpeg', self.ffmpeg), ('ffprobe', self.ffprobe)):
            (target / (name + ('.exe' if host == 'win32' else ''))).symlink_to(source)
        env = os.environ.copy()
        env['PATH'] = ''
        status, result = cli(self.project, 'doctor', env=env)
        self.assertEqual(status, 0, result)
        self.assertTrue(result['operations']['frames']['available'])

    def test_clip_uses_selected_audio_track_not_default_track(self):
        clip = self.command('clip', '--source', str(self.source), '--from', '0.25', '--to', '1.25',
                            '--audio-stream', '1')
        movie = self.project / 'public' / clip['outputs'][0]['file']
        extracted = self.command('audio', '--source', str(movie))
        audio_path = self.project / 'public' / extracted['outputs'][0]['file']
        with wave.open(str(audio_path), 'rb') as audio:
            frames, rate = audio.getnframes(), audio.getframerate()
            values = array.array('h', audio.readframes(frames))
        if sys.byteorder != 'little':
            values.byteswap()
        crossings = sum(a < 0 <= b or a >= 0 > b for a, b in zip(values, values[1:]))
        self.assertAlmostEqual(crossings / (frames / rate), 1760, delta=30)

    def test_cover_art_does_not_count_as_video(self):
        cover_audio = self.project / 'cover-art.m4a'
        cover_image = self.project / 'cover.png'
        Image.new('RGB', (96, 64), '#eeeeee').save(cover_image)
        self.run_ffmpeg('-i', str(self.fixtures / 'low.wav'), '-i', str(cover_image),
                        '-map', '0:a:0', '-map', '1:v:0', '-c:a', 'aac', '-c:v', 'png',
                        '-disposition:v:0', 'attached_pic', '-f', 'mp4', str(cover_audio))
        result = self.command('frames', '--source', str(cover_audio), '--at', '0.25', code=1)
        self.assertEqual(result['error']['code'], 'missing_video')
        result = self.command('clip', '--source', str(cover_audio), '--from', '0', '--to', '1', code=1)
        self.assertEqual(result['error']['code'], 'missing_video')

    def test_local_playlist_cannot_trigger_implicit_network_requests(self):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.path)
                self.send_response(404)
                self.end_headers()

            def log_message(self, *args):
                pass

        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        playlist = self.project / 'remote-reference.m3u8'
        playlist.write_text('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n'
                            '#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:2,\n'
                            'http://127.0.0.1:%d/segment.ts\n#EXT-X-ENDLIST\n' % server.server_port)
        result = self.command('probe', '--source', str(playlist), code=1)
        self.assertEqual(result['error']['code'], 'invalid_media')
        self.assertEqual(requests, [], 'Local media inspection must not fetch playlist URLs.')

    def test_rotation_and_pixel_aspect_are_reported_and_extraction_preserves_display_orientation(self):
        rotated = self.project / 'rotation-90.mp4'
        help_text = subprocess.run([self.ffmpeg, '-hide_banner', '-h', 'full'], env=self.env,
                                   capture_output=True, text=True, check=True).stdout
        if '-display_rotation' in help_text:
            self.run_ffmpeg('-display_rotation:v:0', '90', '-i', str(self.silent), '-c', 'copy', str(rotated))
        else:
            self.run_ffmpeg('-i', str(self.silent), '-c', 'copy', '-metadata:s:v:0', 'rotate=90', str(rotated))
        result = self.command('probe', '--source', str(rotated))
        video = result['metadata']['streams'][0]
        self.assertEqual((video['width'], video['height']), (96, 64))
        self.assertEqual(video['sample_aspect_ratio'], '1:1')
        self.assertEqual(video['display_aspect_ratio'], '3:2')
        self.assertTrue(any(abs(item.get('rotation', 0)) == 90 for item in video['side_data_list']))
        result = self.command('frames', '--source', str(rotated), '--at', '0.25')
        record = self.check_record(result, rotated)
        self.assertEqual(record['strategy']['autorotate'], 'ffmpeg-default')
        with Image.open(self.project / 'public' / record['outputs'][0]['file']) as image:
            self.assertEqual(image.size, (64, 96))
        result = self.command('clip', '--source', str(rotated), '--from', '0', '--to', '1')
        video = result['outputs'][0]['metadata']['streams'][0]
        self.assertEqual((video['width'], video['height']), (64, 96))


if __name__ == '__main__':
    unittest.main()
