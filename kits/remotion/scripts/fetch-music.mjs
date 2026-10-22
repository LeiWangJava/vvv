// Fetch download-only tracks listed in public/music/sources.json and verify their SHA-256.
//
//   node scripts/fetch-music.mjs                 tracks inputs.json references, plus files its template needs
//   node scripts/fetch-music.mjs --all           every download track
//   node scripts/fetch-music.mjs --track mixkit-skyline.mp3
//   node scripts/fetch-music.mjs --from-dir DIR  copy from local files instead of downloading
//
// Each file is written to public/<dir>/ (music unless the record names another dir). Existing files with the expected
// hash are kept; a mismatch is replaced. Nothing is written unless the content verifies.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, all: { type: 'boolean', default: false },
  track: { type: 'string', multiple: true }, 'from-dir': { type: 'string' },
}});
const project = path.resolve(values.project ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const musicDir = path.join(project, 'public', 'music');

const TIMEOUT_MS = Number(process.env.VVV_MUSIC_TIMEOUT_MS) || 120000;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = (file) => stat(file).then((s) => s.isFile(), () => false);

async function wanted(tracks) {
  if (values.all) return tracks;
  if (values.track?.length) {
    const unknown = values.track.filter((name) => !tracks.some((t) => t.file === name));
    if (unknown.length) throw new Error(`MUSIC_UNKNOWN: ${unknown.join(', ')} is not a download track in sources.json.`);
    return tracks.filter((t) => values.track.includes(t.file));
  }
  const input = JSON.parse(await readFile(path.join(project, 'inputs.json'), 'utf8'));
  const refs = new Set(JSON.stringify(input.props ?? {}).match(/[a-z]+\/[^"]+/g) ?? []);
  return tracks.filter((t) => refs.has(`${t.dir ?? 'music'}/${t.file}`) || (t.templates ?? []).includes(input.template));
}

async function obtain(track) {
  if (values['from-dir']) return readFile(path.join(path.resolve(values['from-dir']), track.file));
  try {
    const response = await fetch(track.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`MUSIC_DOWNLOAD: ${track.file}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(`MUSIC_TIMEOUT: ${track.file}: no complete response from ${new URL(track.url).host} within ${TIMEOUT_MS / 1000} s; `
        + 'retry, or download it yourself and use --from-dir.');
    }
    if (/^MUSIC_/.test(error.message)) throw error;
    throw new Error(`MUSIC_DOWNLOAD: ${track.file}: ${error.cause?.message ?? error.message}`);
  }
}

async function main() {
  const sources = JSON.parse(await readFile(path.join(musicDir, 'sources.json'), 'utf8'));
  const downloads = sources.tracks.filter((t) => t.distribution === 'download');
  const results = [];
  for (const track of await wanted(downloads)) {
    const dir = track.dir ?? 'music';
    if (path.basename(track.file) !== track.file || !/^[a-z]+$/.test(dir)) throw new Error(`MUSIC_PATH: ${dir}/${track.file}`);
    const target = path.join(project, 'public', dir, track.file);
    await mkdir(path.dirname(target), { recursive: true });
    if (await exists(target) && sha256(await readFile(target)) === track.sha256) {
      results.push({ file: `${dir}/${track.file}`, status: 'present' });
      continue;
    }
    const bytes = await obtain(track);
    if (bytes.length !== track.bytes || sha256(bytes) !== track.sha256) {
      throw new Error(`MUSIC_HASH: ${track.file} does not match the recorded size and SHA-256; nothing was written.`);
    }
    const temporary = `${target}.partial`;
    await writeFile(temporary, bytes);
    try { await rename(temporary, target); } catch (error) { await rm(temporary, { force: true }); throw error; }
    results.push({ file: `${dir}/${track.file}`, status: 'fetched', license: track.license });
  }
  console.log(JSON.stringify({ status: 'passed', tracks: results }, null, 2));
}

main().catch((error) => {
  const [, code = 'MUSIC_FAILED', message = error.message] = /^([A-Z][A-Z0-9_]+): ([\s\S]*)$/.exec(error.message) ?? [];
  console.log(JSON.stringify({ status: 'failed', code, message }));
  process.exitCode = 1;
});
