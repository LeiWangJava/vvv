import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const manifestPath = path.join(root, 'font-sources.json');
const specs = [
  ['NotoSerifSC', 'normal', ['400', '700']],
  ['Caveat', 'normal', ['600']],
  ['Lora', 'normal', ['500']], ['Lora', 'italic', ['400']],
  ['NunitoSans', 'normal', ['500', '600', '800']],
  ['PlayfairDisplay', 'normal', ['400']], ['BodoniModa', 'normal', ['500']],
  ['Tangerine', 'normal', ['400']], ['ZhiMangXing', 'normal', ['400']],
  ['BarlowCondensed', 'normal', ['800']], ['LongCang', 'normal', ['400']],
  ['KleeOne', 'normal', ['600'], '以么—'],
  ['Inter', 'normal', ['400', '500', '600']], ['Silkscreen', 'normal', ['700']],
  ['NotoColorEmoji', 'normal', ['400']],
  // Comedy: headline brush, playful captions, plain sans and an English serif
  ['NotoSansSC', 'normal', ['400', '700']], ['MaShanZheng', 'normal', ['400']],
  ['ZCOOLKuaiLe', 'normal', ['400']], ['CormorantGaramond', 'normal', ['500']],
  // terminal and caption text in the wedding fixtures
  ['JetBrainsMono', 'normal', ['400', '700']],
];

const covers = (range, text) => range.split(',').some((part) => {
  const [lo, hi = lo] = part.trim().replace(/^U\+/i, '').split('-').map((n) => parseInt(n, 16));
  return [...text].some((c) => c.codePointAt(0) >= lo && c.codePointAt(0) <= hi);
});

if (process.argv.includes('--verify')) {
  const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const files = [...new Map([...data.faces, ...data.licenses].map((item) => [item.file, item])).values()];
  for (const item of files) {
    if (!item.file.startsWith('fonts/') || item.file.includes('..')) throw new Error(`Unsafe font path: ${item.file}`);
    const bytes = await fs.readFile(path.join(root, 'public', item.file));
    if (digest(bytes) !== item.sha256) throw new Error(`Font integrity mismatch: ${item.file}`);
  }
  console.log(JSON.stringify({ ok: true, verifiedFiles: files.length, networkRequests: 0 }));
  process.exit(0);
}

const families = new Map();
const faces = [];
const requests = new Map();
for (const [module, style, weights, text] of specs) {
  const info = (await import(`@remotion/google-fonts/${module}`)).getInfo();
  families.set(module, { module, family: info.fontFamily, providerVersion: info.version, cssSource: info.url });
  for (const weight of weights) {
    const subsets = info.fonts[style]?.[weight];
    if (!subsets) throw new Error(`Missing font configuration ${module}/${style}/${weight}`);
    for (const [subset, url] of Object.entries(subsets)) {
      const unicodeRange = info.unicodeRanges[subset];
      if (!unicodeRange) throw new Error(`Missing Unicode range ${module}/${subset}`);
      if (text && !covers(unicodeRange, text)) continue;
      // Include each provider's available script subsets, avoiding host-font fallbacks in edited copy.
      const file = `fonts/files/${digest(url).slice(0, 24)}.woff2`;
      requests.set(url, { url, file });
      faces.push({ module, family: info.fontFamily, style, weight, subset, unicodeRange, source: url, file });
    }
  }
}

const download = async ({ url, file }) => {
  const parsed = new URL(url);
  if (!['fonts.gstatic.com', 'raw.githubusercontent.com'].includes(parsed.hostname)) throw new Error(`Unexpected font provider: ${parsed.hostname}`);
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (file.endsWith('.woff2') && bytes.subarray(0, 4).toString() !== 'wOF2') throw new Error(`Not a WOFF2 file: ${url}`);
      if (file.endsWith('.txt') && !bytes.toString().includes('SIL OPEN FONT LICENSE')) throw new Error(`Unexpected license document: ${url}`);
      await fs.mkdir(path.dirname(path.join(root, 'public', file)), { recursive: true });
      await fs.writeFile(path.join(root, 'public', file), bytes);
      return { file, sha256: digest(bytes), bytes: bytes.length };
    } catch (cause) { error = cause; }
  }
  throw error;
};

const queue = [...requests.values()];
const downloaded = new Map();
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < queue.length) {
    const item = queue[next++];
    downloaded.set(item.url, await download(item));
    if (downloaded.size % 50 === 0) console.log(`Fonts: ${downloaded.size}/${queue.length}`);
  }
}));

const licenses = [];
for (const [module, info] of families) {
  const source = `https://raw.githubusercontent.com/google/fonts/main/ofl/${module.toLowerCase()}/OFL.txt`;
  const item = await download({ url: source, file: `fonts/licenses/${module}-OFL.txt` });
  licenses.push({ family: info.family, source, ...item });
}
const result = {
  version: '0.1', preparedAt: new Date().toISOString(), provider: 'Google Fonts',
  metadataPackage: `@remotion/google-fonts@${createRequire(import.meta.url)('@remotion/google-fonts/package.json').version}`,
  note: 'Font files are unmodified provider WOFF2 subsets. Klee One is restricted to the three explicit DV glyph patches. Other listed font styles include their available Unicode subsets. Font licenses apply to these files, not the entire VVV project.',
  families: [...families.values()],
  faces: faces.map((face) => ({ ...face, ...downloaded.get(face.source) })),
  licenses,
};
await fs.writeFile(manifestPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, families: families.size, faces: faces.length, files: downloaded.size, bytes: [...downloaded.values()].reduce((sum, item) => sum + item.bytes, 0), licenses: licenses.length }));
