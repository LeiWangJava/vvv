import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frameRange, fingerprint } from './render-support.mjs';

test('sample bounds use the actual main-composition frame interval', () => {
  assert.deepEqual(frameRange({from:35,to:50}, {fps:30,durationInFrames:4260}), [1050,1499]);
  assert.deepEqual(frameRange({from:0,to:2}, {fps:24,durationInFrames:48}), [0,47]);
});

test('invalid or oversized ranges are rejected instead of silently clamped', () => {
  for (const range of [{from:-1,to:1},{from:1,to:1},{from:0,to:NaN},{from:0,to:5}]) {
    assert.throws(() => frameRange(range,{fps:30,durationInFrames:60}), /FRAME_RANGE/);
  }
});

test('fingerprint tracks source and media, excluding rendered output', async () => {
  const folder = await mkdtemp(join(tmpdir(),'vvv-fingerprint-'));
  try {
    await mkdir(join(folder,'src'));
    await mkdir(join(folder,'out'));
    await writeFile(join(folder,'src','index.tsx'),'a');
    const before = await fingerprint(folder);
    await writeFile(join(folder,'out','result.mp4'),'rendered');
    assert.equal(await fingerprint(folder),before);
    await writeFile(join(folder,'src','index.tsx'),'b');
    assert.notEqual(await fingerprint(folder),before);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

test('render preflight rejects symlinked source and unlisted decoration assets', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'vvv-links-'));
  try {
    await mkdir(join(folder, 'outside'));
    await writeFile(join(folder, 'outside', 'art.png'), 'outside-art');
    await symlink(join(folder, 'outside'), join(folder, 'public'));
    await assert.rejects(fingerprint(folder), /PROJECT_SYMLINK/);
    await rm(join(folder, 'public'));
    await mkdir(join(folder, 'public'));
    await symlink(join(folder, 'outside', 'art.png'), join(folder, 'public', 'art.png'));
    await assert.rejects(fingerprint(folder), /PROJECT_SYMLINK/);
    await rm(join(folder, 'public', 'art.png'));
    await symlink(join(folder, 'outside'), join(folder, 'src'));
    await assert.rejects(fingerprint(folder), /PROJECT_SYMLINK/);
  } finally { await rm(folder, {recursive:true, force:true}); }
});

test('fingerprint orders paths by UTF-8 bytes, as the Python helper does', async () => {
  const { createHash } = await import('node:crypto');
  const folder = await mkdtemp(join(tmpdir(), 'vvv-order-'));
  try {
    await mkdir(join(folder, 'src'));
    // U+FF5E sorts before U+1F600 in UTF-8, after it in UTF-16 (the default string sort).
    const names = ['src/\u{1F600}.ts', 'src/\uFF5E.ts', 'src/a.ts'];
    for (const name of names) await writeFile(join(folder, name), name);
    const hash = createHash('sha256');
    for (const name of ['src/a.ts', 'src/\uFF5E.ts', 'src/\u{1F600}.ts']) {
      hash.update(name);
      hash.update(Buffer.from([0]));
      hash.update(createHash('sha256').update(name).digest());
    }
    assert.equal(await fingerprint(folder), hash.digest('hex'));
  } finally { await rm(folder, {recursive:true, force:true}); }
});
