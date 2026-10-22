"""Offline transport tests: all HTTP traffic stays on a local fixture server."""

import base64
from contextlib import contextmanager
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1] / 'skills' / 'vvv' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
try:
    import vvv_image_api as api
except ModuleNotFoundError:
    api = None


class ImageAPITests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(api, 'The Images API adapter has not been implemented')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.destination = self.base / 'output.png'
        self.secret = 'fixture-only-secret-never-a-real-key'
        self.env = patch.dict(os.environ, {
            'VVV_TEST_IMAGE_KEY': self.secret,
            'no_proxy': '127.0.0.1,localhost,::1',
            'NO_PROXY': '127.0.0.1,localhost,::1',
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.request = {'operation': 'generate', 'prompt': '蓝色花朵',
                        'background': 'opaque', 'size': '1024x1024', 'format': 'png'}
        output = io.BytesIO()
        Image.new('RGBA', (3, 2), (0, 120, 240, 0)).save(output, format='PNG')
        self.image = output.getvalue()
        self.response = {'created': 1, 'data': [
            {'b64_json': base64.b64encode(self.image).decode('ascii')}]}

    @contextmanager
    def server(self, status=200, response=None, headers=None, delay=0):
        calls = []
        body = json.dumps(self.response if response is None else response).encode()

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                calls.append({'method': 'POST', 'path': self.path,
                              'headers': self.headers,
                              'body': self.rfile.read(int(self.headers['Content-Length']))})
                if delay:
                    time.sleep(delay)
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                for name, value in (headers or {}).items():
                    self.send_header(name, value)
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def do_GET(self):
                calls.append({'method': 'GET', 'path': self.path})
                self.send_response(404)
                self.end_headers()

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever,
                                  kwargs={'poll_interval': 0.01}, daemon=True)
        worker.start()
        config = {'base_url': 'http://127.0.0.1:%s/v1' % server.server_port,
                  'model': 'configured-image-model', 'key_env': 'VVV_TEST_IMAGE_KEY',
                  'capabilities': {'edit': True, 'transparent': True}}
        try:
            yield config, calls
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def fail_with(self, code, config, request=None, references=None):
        with self.assertRaises(api.ImageAPIError) as caught:
            api.generate(config, request or self.request, references or [], self.destination)
        self.assertEqual(caught.exception.code, code)
        self.assertTrue(caught.exception.message)
        self.assertNotIn(self.secret, str(caught.exception))
        self.assertFalse(self.destination.exists())
        return caught.exception

    def reference(self, name='not-really-a-jpeg.jpg'):
        reference = self.base / name
        reference.write_bytes(self.image)
        return reference

    def test_generate_posts_one_json_request_and_saves_base64_image(self):
        with self.server() as (config, calls):
            result = api.generate(config, self.request, [], self.destination)
        self.assertEqual(result, {'provider': 'api', 'model': 'configured-image-model',
                                  'transport': 'images-api', 'base_url': config['base_url']})
        self.assertEqual(self.destination.read_bytes(), self.image)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['path'], '/v1/images/generations')
        self.assertEqual(calls[0]['headers']['Authorization'], 'Bearer ' + self.secret)
        self.assertEqual(calls[0]['headers'].get_content_type(), 'application/json')
        self.assertEqual(json.loads(calls[0]['body']), {
            'model': 'configured-image-model', 'prompt': '蓝色花朵', 'n': 1,
            'background': 'opaque', 'size': '1024x1024', 'output_format': 'png'})
        self.assertNotIn(self.secret, json.dumps(result))

    def test_auto_parameters_are_omitted_without_changing_configured_model(self):
        request = {**self.request, 'background': 'auto', 'size': 'auto', 'format': 'webp'}
        with self.server() as (config, calls):
            config['base_url'] += '/'
            result = api.generate(config, request, [], self.destination)
        self.assertEqual(result['base_url'], config['base_url'].rstrip('/'))
        self.assertEqual(json.loads(calls[0]['body']), {
            'model': 'configured-image-model', 'prompt': '蓝色花朵',
            'n': 1, 'output_format': 'webp'})

    def test_edit_uses_multipart_images_with_mime_from_content(self):
        refs = [self.reference(), self.reference('second.unknown')]
        request = {**self.request, 'operation': 'edit', 'background': 'transparent'}
        with self.server() as (config, calls):
            api.generate(config, request, refs, self.destination)
        self.assertEqual(calls[0]['path'], '/v1/images/edits')
        message = BytesParser(policy=policy.default).parsebytes(
            ('Content-Type: ' + calls[0]['headers']['Content-Type'] + '\r\n\r\n').encode()
            + calls[0]['body'])
        parts = list(message.iter_parts())
        images = [p for p in parts if p.get_param('name', header='content-disposition') == 'image[]']
        self.assertEqual(len(images), 2)
        for part in images:
            self.assertEqual(part.get_content_type(), 'image/png')
            self.assertEqual(part.get_payload(decode=True), self.image)
        fields = {p.get_param('name', header='content-disposition'):
                  p.get_payload(decode=True).decode() for p in parts if p not in images}
        self.assertEqual(fields, {'model': 'configured-image-model', 'prompt': '蓝色花朵',
                                 'n': '1', 'background': 'transparent',
                                 'size': '1024x1024', 'output_format': 'png'})
        self.assertNotIn(str(self.base).encode(), calls[0]['body'])

    def test_generate_with_reference_uses_edit_endpoint(self):
        with self.server() as (config, calls):
            api.generate(config, self.request, [self.reference()], self.destination)
        self.assertEqual(calls[0]['path'], '/v1/images/edits')

    def test_capability_failure_prevents_network_request(self):
        with self.server() as (config, calls):
            config['capabilities'] = {'edit': False, 'transparent': False}
            self.fail_with('unsupported_capability', config,
                           {**self.request, 'background': 'transparent'})
            self.fail_with('unsupported_capability', config, references=[self.reference()])
            self.assertEqual(calls, [])

    def test_transparent_jpeg_and_edit_without_reference_are_rejected(self):
        with self.server() as (config, calls):
            self.fail_with('unsupported_capability', config,
                           {**self.request, 'background': 'transparent', 'format': 'jpeg'})
            self.fail_with('unsupported_capability', config,
                           {**self.request, 'operation': 'edit'})
            self.assertEqual(calls, [])

    def test_missing_key_and_malformed_config_do_not_send_request(self):
        with self.server() as (config, calls):
            with patch.dict(os.environ, {'VVV_TEST_IMAGE_KEY': ''}):
                self.fail_with('configuration_required', config)
            for changes in [{'model': ''}, {'key_env': 'NOT A VARIABLE'},
                            {'capabilities': {'edit': 'yes', 'transparent': False}},
                            {'timeout': 0}, {'timeout': 601}, {'timeout': True},
                            {'timeout': float('nan')}, {'timeout': 10 ** 1000},
                            {'timeout': '180'}]:
                with self.subTest(changes=changes):
                    self.fail_with('configuration_required', {**config, **changes})
            self.assertEqual(calls, [])

    def test_unsafe_urls_are_rejected_before_authentication_is_sent(self):
        with self.server() as (config, calls):
            for url in ['http://example.com/v1', 'file:///tmp/images',
                        'https://user:password@example.com/v1',
                        config['base_url'] + '?secret=bad', config['base_url'] + '#fragment',
                        config['base_url'] + '?', 'https://example.com:invalid/v1',
                        'https://example.com/v1\r\nInjected: bad']:
                with self.subTest(url=url):
                    self.fail_with('configuration_required', {**config, 'base_url': url})
            self.assertEqual(calls, [])

    def test_auth_quota_and_server_errors_are_safe_and_never_retried(self):
        for status, code in [(401, 'api_auth'), (403, 'api_auth'),
                             (429, 'api_quota'), (500, 'api_error')]:
            with self.subTest(status=status):
                with self.server(status=status, response={'error': {'message': self.secret}}) as (config, calls):
                    self.fail_with(code, config)
                    self.assertEqual(len(calls), 1)

    def test_all_redirects_are_rejected_without_forwarding_or_retrying(self):
        for status in [301, 302, 303, 307, 308]:
            with self.subTest(status=status):
                with self.server(status=status, headers={'Location': '/redirect-target'}) as (config, calls):
                    self.fail_with('api_error', config)
                    self.assertEqual(len(calls), 1)
                    self.assertEqual(calls[0]['method'], 'POST')

    def test_timeout_is_classified_and_not_retried(self):
        with self.server(delay=1.2) as (config, calls):
            self.fail_with('api_timeout', {**config, 'timeout': 1})
            self.assertEqual(len(calls), 1)

    def test_invalid_base64_and_response_shapes_leave_no_file(self):
        for response in [{'data': [{'b64_json': '!!!!'}]}, {'data': [{'b64_json': ''}]},
                         {'data': [{'b64_json': 123}]}, {'data': []}, [],
                         {'data': [None]}]:
            with self.subTest(response=response):
                with self.server(response=response) as (config, calls):
                    self.fail_with('invalid_output', config)
                    self.assertEqual(len(calls), 1)

    def test_url_only_output_is_not_downloaded(self):
        with self.server(response={'data': [{'url': 'http://127.0.0.1:1/private'}]}) as (config, calls):
            self.fail_with('invalid_output', config)
            self.assertEqual(len(calls), 1)

    def test_payload_response_and_decoded_image_limits_are_enforced(self):
        with self.server() as (config, calls):
            with patch.object(api, 'MAX_REQUEST_BYTES', 32):
                self.fail_with('unsupported_capability', config)
            self.assertEqual(calls, [])
            with patch.object(api, 'MAX_RESPONSE_BYTES', 32):
                self.fail_with('invalid_output', config)
            with patch.object(api, 'MAX_IMAGE_BYTES', 16):
                self.fail_with('invalid_output', config)
            self.assertEqual(len(calls), 2)

    def test_reference_and_prompt_limits_fail_before_network(self):
        reference = self.reference()
        with self.server() as (config, calls):
            self.fail_with('unsupported_capability', config,
                           {**self.request, 'prompt': 'x' * 32001})
            self.fail_with('unsupported_capability', config, references=[reference] * 17)
            with patch.object(api, 'MAX_IMAGE_BYTES', 16):
                self.fail_with('unsupported_capability', config, references=[reference])
            self.assertEqual(calls, [])

    def test_existing_destination_is_preserved_without_network(self):
        self.destination.write_bytes(b'user-content')
        with self.server() as (config, calls):
            with self.assertRaises(api.ImageAPIError):
                api.generate(config, self.request, [], self.destination)
            self.assertEqual(self.destination.read_bytes(), b'user-content')
            self.assertEqual(calls, [])


if __name__ == '__main__':
    unittest.main()
