import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const script = fileURLToPath(new URL('./fetch-music.mjs', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function project(track) {
  const root = await mkdtemp(join(tmpdir(), 'vvv-music-'));
  await mkdir(join(root, 'public', 'music'), { recursive: true });
  await writeFile(join(root, 'public', 'music', 'sources.json'), JSON.stringify({ version: '0.1', tracks: [track] }));
  await writeFile(join(root, 'inputs.json'), JSON.stringify({ template: 'starter', props: { music: { src: `music/${track.file}` } } }));
  return root;
}

const fetchMusic = async (root, ...args) => {
  const env = typeof args.at(-1) === 'object' ? { ...process.env, ...args.pop() } : process.env;
  try {
    const { stdout } = await run(process.execPath, [script, '--project', root, ...args], { env });
    return JSON.parse(stdout);
  } catch (error) {
    return JSON.parse(error.stdout);
  }
};

test('a referenced download track is copied only when size and hash verify', async () => {
  const audio = Buffer.from('fictional audio bytes');
  const source = await mkdtemp(join(tmpdir(), 'vvv-music-src-'));
  await writeFile(join(source, 'mixkit-test.mp3'), audio);
  const root = await project({ file: 'mixkit-test.mp3', distribution: 'download', bytes: audio.length, sha256: sha(audio), url: 'https://example.test/never-called.mp3' });
  const first = await fetchMusic(root, '--from-dir', source);
  assert.equal(first.status, 'passed');
  assert.deepEqual(first.tracks.map((t) => [t.file, t.status]), [['music/mixkit-test.mp3', 'fetched']]);
  assert.deepEqual(await readFile(join(root, 'public', 'music', 'mixkit-test.mp3')), audio);
  const again = await fetchMusic(root, '--from-dir', source);
  assert.deepEqual(again.tracks.map((t) => t.status), ['present']);
});

test('a mismatched file is refused and nothing is written', async () => {
  const source = await mkdtemp(join(tmpdir(), 'vvv-music-src-'));
  await writeFile(join(source, 'mixkit-test.mp3'), 'tampered');
  const root = await project({ file: 'mixkit-test.mp3', distribution: 'download', bytes: 5, sha256: sha('right'), url: 'https://example.test/x.mp3' });
  const result = await fetchMusic(root, '--from-dir', source);
  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'MUSIC_HASH');
  assert.match(result.message, /nothing was written/);
  await assert.rejects(stat(join(root, 'public', 'music', 'mixkit-test.mp3')));
  await assert.rejects(stat(join(root, 'public', 'music', 'mixkit-test.mp3.partial')));
});

test('unknown track names fail before any download', async () => {
  const root = await project({ file: 'mixkit-test.mp3', distribution: 'download', bytes: 1, sha256: sha('x'), url: 'https://example.test/x.mp3' });
  const result = await fetchMusic(root, '--track', 'other.mp3');
  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'MUSIC_UNKNOWN');
});

test('files a template needs are fetched into their own folder even when inputs do not name them', async () => {
  const audio = Buffer.from('fictional effect');
  const source = await mkdtemp(join(tmpdir(), 'vvv-music-src-'));
  await writeFile(join(source, 'mixkit-pop.wav'), audio);
  const root = await project({ file: 'mixkit-pop.wav', dir: 'sfx', templates: ['starter'], distribution: 'download', bytes: audio.length, sha256: sha(audio), url: 'https://example.test/x.wav' });
  const result = await fetchMusic(root, '--from-dir', source);
  assert.deepEqual(result.tracks.map((t) => t.file), ['sfx/mixkit-pop.wav']);
  assert.deepEqual(await readFile(join(root, 'public', 'sfx', 'mixkit-pop.wav')), audio);
});

test('a download that never answers times out with a clear error', async () => {
  const server = createServer(() => {}).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/mixkit-test.mp3`;
    const root = await project({ file: 'mixkit-test.mp3', distribution: 'download', bytes: 1, sha256: sha('x'), url });
    const result = await fetchMusic(root, { VVV_MUSIC_TIMEOUT_MS: '300' });
    assert.equal(result.status, 'failed');
    assert.equal(result.code, 'MUSIC_TIMEOUT');
    assert.match(result.message, /--from-dir/);
    await assert.rejects(stat(join(root, 'public', 'music', 'mixkit-test.mp3')));
  } finally { server.closeAllConnections?.(); server.close(); }
});
