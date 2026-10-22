"""Offline contract tests: every Codex subprocess is a temporary local fake."""
import hashlib
import importlib.util
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'skills/vvv/scripts/vvv_image_c2c.py'
VENDOR = ROOT / 'skills/vvv/vendor/c2c_img'
EXEC_HELP = ('--ignore-user-config --ignore-rules --ephemeral --json '
             '--skip-git-repo-check --sandbox --cd --enable --disable --image')


class C2CTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.is_file(), 'The c2c bridge has not been implemented')
        spec = importlib.util.spec_from_file_location('tested_vvv_image_c2c', SCRIPT)
        self.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.bridge)
        self.temp = tempfile.TemporaryDirectory(prefix='vvv-c2c-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.destination = self.base / 'output' / 'native.png'
        self.log = self.base / 'commands.jsonl'

    def fake_cli(self, status='Logged in using ChatGPT', login_code=0,
                 feature='image_generation stable true', help_text=EXEC_HELP,
                 feature_code=0):
        path = self.base / 'fake-codex'
        responses = {
            '--version': ('codex-cli 9.9.9', '', 0),
            'login status': ('', status, login_code),
            'features list': (feature, '', feature_code),
            'exec --help': (help_text, '', 0),
        }
        path.write_text(
            '#!' + sys.executable + '\n'
            'import json, sys\n'
            'responses = ' + repr(responses) + '\n'
            'with open(' + repr(str(self.log)) + ', "a") as log:\n'
            '    log.write(json.dumps(sys.argv[1:]) + "\\n")\n'
            'stdout, stderr, code = responses.get(" ".join(sys.argv[1:]), '
            '("", "unexpected command", 97))\n'
            'print(stdout, end="", file=sys.stdout)\n'
            'print(stderr, end="", file=sys.stderr)\n'
            'sys.exit(code)\n', encoding='utf-8')
        path.chmod(0o700)
        return str(path)

    def request(self, **updates):
        value = {'operation': 'generate', 'prompt': 'A quiet blue garden.',
                 'background': 'opaque', 'size': 'auto', 'format': 'png'}
        return dict(value, **updates)

    def source(self):
        path = self.base / 'upstream' / 'generated.png'
        path.parent.mkdir(exist_ok=True)
        Image.frombytes('RGB', (32, 32), random.Random(4).randbytes(32 * 32 * 3)).save(path)
        return path

    def execution_result(self, **updates):
        result = {'engine': 'exec-lean', 'src': None, 'timed_out': False,
                  'errors': [], 'reply': '', 'stderr_tail': [], 'elapsed_s': 0.1}
        return dict(result, **updates)

    def test_probe_rejects_not_logged_in_even_with_zero_exit(self):
        for code in (0, 1):
            result = self.bridge.probe(self.fake_cli('Not logged in', login_code=code))
            self.assertFalse(result['available'])
            self.assertEqual(result['auth'], 'none')
            self.assertEqual(result['reason'], 'auth_required')

    def test_probe_reports_only_local_chatgpt_prerequisites(self):
        binary = self.fake_cli(feature='image_generation stable false')
        result = self.bridge.probe(binary)
        self.assertEqual(result, {
            'available': True, 'auth': 'chatgpt', 'codex_bin': binary,
            'version': '9.9.9', 'capability': 'unverified', 'reason': 'ready',
        })
        commands = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertNotIn(['exec'], commands)
        self.assertNotIn(['app-server'], commands)

    def test_api_key_auth_is_not_a_subscription_route_and_is_redacted(self):
        secret = 'sk-test-must-not-leak'
        result = self.bridge.probe(self.fake_cli('Logged in using an API key - ' + secret))
        self.assertFalse(result['available'])
        self.assertEqual(result['auth'], 'api-key')
        self.assertEqual(result['reason'], 'api_key_auth')
        self.assertNotIn(secret, json.dumps(result))

    def test_auth_requires_successful_exit_and_explicit_chatgpt_method(self):
        for status, code in [('Logged in using ChatGPT', 1), ('Logged in', 0)]:
            result = self.bridge.probe(self.fake_cli(status, login_code=code))
            self.assertFalse(result['available'])
            self.assertEqual(result['auth'], 'unknown')

    def test_missing_feature_and_incompatible_flags_are_diagnostics(self):
        for feature in ('', 'image_generation removed true'):
            result = self.bridge.probe(self.fake_cli(feature=feature))
            self.assertFalse(result['available'])
            self.assertEqual(result['reason'], 'feature_unavailable')
        result = self.bridge.probe(self.fake_cli(help_text='--json --image'))
        self.assertFalse(result['available'])
        self.assertEqual(result['reason'], 'cli_incompatible')
        result = self.bridge.probe(self.fake_cli(feature_code=2))
        self.assertEqual(result['reason'], 'cli_incompatible')

    def test_probe_failures_do_not_escape_or_expose_process_output(self):
        result = self.bridge.probe(str(self.base / 'missing-codex'))
        self.assertFalse(result['available'])
        self.assertEqual(result['reason'], 'codex_missing')
        binary = self.fake_cli()
        with mock.patch.object(self.bridge.subprocess, 'run',
                               side_effect=subprocess.TimeoutExpired('secret-command', 1,
                                                                    stderr='secret-output')):
            result = self.bridge.probe(binary)
        self.assertFalse(result['available'])
        self.assertNotIn('secret', json.dumps(result))

    def test_generate_calls_lean_once_preserves_prompt_and_copies_native_image(self):
        binary = self.fake_cli()
        source = self.source()
        before = source.read_bytes()
        reference = self.base / 'reference.png'
        reference.write_bytes(before)
        upstream = self.bridge._load_upstream()
        request = self.request(operation='edit', prompt='Keep Image 1.\nChange only the sky.',
                               background='transparent', size='1920x1080')
        with mock.patch.object(upstream, 'run_exec',
                               return_value=self.execution_result(src=str(source))) as execute, \
                mock.patch.object(upstream, 'run_job', side_effect=AssertionError('No fallback')), \
                mock.patch.object(upstream, 'ensure_daemon', side_effect=AssertionError('No daemon')):
            result = self.bridge.generate({'codex_bin': binary, 'timeout': 125}, request,
                                          [reference], self.destination)
        self.assertEqual(execute.call_count, 1)
        job, options, selected = execute.call_args.args
        self.assertEqual(execute.call_args.kwargs, {'lean': True})
        self.assertEqual(selected, binary)
        self.assertEqual(job['prompt'], 'Keep Image 1.\nChange only the sky.')
        self.assertEqual(job['refs'], [str(reference)])
        self.assertTrue(job['transparent'])
        self.assertIsNone(job['size'])
        self.assertFalse(options.keep_session)
        self.assertIsNone(options.model)
        self.assertEqual(options.timeout, 125)
        self.assertEqual(self.destination.read_bytes(), before)
        self.assertEqual(source.read_bytes(), before)
        self.assertEqual(result['provider'], 'c2c')
        self.assertEqual(result['engine'], 'exec-lean')
        self.assertIsNone(result['model'])
        self.assertEqual(result['upstream_version'], '0.4.1')
        self.assertEqual(result['upstream_commit'], 'ff836516ba56610ebdddd6d9ae66a653694e0e71')
        self.assertEqual(result['source_format'], 'png')

    def test_generate_blocks_api_auth_before_starting_a_turn(self):
        binary = self.fake_cli('Logged in using an API key - sk-secret')
        with mock.patch.object(self.bridge._load_upstream(), 'run_exec') as execute:
            with self.assertRaises(self.bridge.C2CError) as caught:
                self.bridge.generate({'codex_bin': binary}, self.request(), [], self.destination)
        self.assertEqual(caught.exception.code, 'c2c_auth')
        self.assertNotIn('sk-secret', caught.exception.message)
        execute.assert_not_called()
        self.assertFalse(self.destination.exists())

    def test_failed_turns_are_classified_without_retry_or_raw_output(self):
        binary = self.fake_cli()
        cases = [
            ({'errors': ['401 Unauthorized secret-token']}, 'c2c_auth'),
            ({'errors': ['quota exceeded secret-token']}, 'c2c_quota'),
            ({'timed_out': True, 'stderr_tail': ['secret-token']}, 'c2c_timeout'),
            ({'errors': ['at capacity secret-token']}, 'c2c_capacity'),
            ({'reply': 'FAILED: content policy secret-token'}, 'c2c_generation_failed'),
            ({'errors': ['model x not supported secret-token']}, 'c2c_model'),
            ({'stderr_tail': ['secret-token']}, 'c2c_unknown'),
        ]
        upstream = self.bridge._load_upstream()
        for updates, expected in cases:
            with self.subTest(code=expected), mock.patch.object(
                    upstream, 'run_exec', return_value=self.execution_result(**updates)) as execute:
                with self.assertRaises(self.bridge.C2CError) as caught:
                    self.bridge.generate({'codex_bin': binary}, self.request(), [], self.destination)
                self.assertEqual(caught.exception.code, expected)
                self.assertNotIn('secret-token', str(caught.exception))
                self.assertNotIn('Traceback', caught.exception.message)
                self.assertEqual(execute.call_count, 1)
        self.assertFalse(self.destination.exists())

    def test_exec_exception_and_incomplete_file_are_sanitized(self):
        binary = self.fake_cli()
        upstream = self.bridge._load_upstream()
        with mock.patch.object(upstream, 'run_exec', side_effect=OSError('secret-token')):
            with self.assertRaises(self.bridge.C2CError) as caught:
                self.bridge.generate({'codex_bin': binary}, self.request(), [], self.destination)
        self.assertEqual(caught.exception.code, 'c2c_unknown')
        self.assertNotIn('secret-token', str(caught.exception))
        incomplete = self.base / 'incomplete.png'
        incomplete.write_bytes(b'partial')
        with mock.patch.object(upstream, 'run_exec',
                               return_value=self.execution_result(src=str(incomplete))):
            with self.assertRaises(self.bridge.C2CError) as caught:
                self.bridge.generate({'codex_bin': binary}, self.request(), [], self.destination)
        self.assertEqual(caught.exception.code, 'c2c_output_invalid')
        self.assertFalse(self.destination.exists())

    def test_existing_output_is_preserved_without_consuming_a_turn(self):
        binary = self.fake_cli()
        self.destination.parent.mkdir()
        self.destination.write_bytes(b'user-owned')
        with mock.patch.object(self.bridge._load_upstream(), 'run_exec') as execute:
            with self.assertRaises(self.bridge.C2CError) as caught:
                self.bridge.generate({'codex_bin': binary}, self.request(), [], self.destination)
        self.assertEqual(caught.exception.code, 'c2c_output_exists')
        self.assertEqual(self.destination.read_bytes(), b'user-owned')
        execute.assert_not_called()

    def test_invalid_timeout_does_not_launch_generation(self):
        binary = self.fake_cli()
        with mock.patch.object(self.bridge._load_upstream(), 'run_exec') as execute:
            for timeout in (0, -1, 0.5, 601, 10 ** 1000, True, float('nan'), '300'):
                with self.subTest(timeout=timeout), self.assertRaises(self.bridge.C2CError) as caught:
                    self.bridge.generate({'codex_bin': binary, 'timeout': timeout},
                                         self.request(), [], self.destination)
                self.assertEqual(caught.exception.code, 'c2c_bad_request')
        execute.assert_not_called()

    def test_vendor_matches_reviewed_upstream_and_license(self):
        data = json.loads((VENDOR / 'UPSTREAM.json').read_text())
        self.assertEqual(data['commit'], 'ff836516ba56610ebdddd6d9ae66a653694e0e71')
        expected = {
            'c2c_img.py': 'd69becf2df8184e72064b0b1d2053e10fdded350a1e5d873f40b977edd8e1989',
            'LICENSE': '6f6c08742fea7f797aa5e14630588045568b5a474acc6d23e407a253a2c8e8ec',
        }
        for name, digest in expected.items():
            self.assertEqual(hashlib.sha256((VENDOR / name).read_bytes()).hexdigest(), digest)
            self.assertEqual(data['sha256'][name], digest)


if __name__ == '__main__':
    unittest.main()
