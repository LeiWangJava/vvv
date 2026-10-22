import test from 'node:test';
import assert from 'node:assert/strict';
import { photoIdFromToken, parsePages, validatePhotoTokens } from './photo-tokens.ts';
import { makeClock } from './clock.ts';
import { buildStory } from './story.ts';
import { calculateStoryMetadata } from './metadata.ts';

test('project photo tokens preserve pages and reject paths or malformed identifiers', () => {
  assert.deepEqual(parsePages('@photo-001 @photo-002|@photo-003'), [['@photo-001', '@photo-002'], ['@photo-003']]);
  assert.equal(photoIdFromToken('@photo-001'), 'photo-001');
  assert.equal(photoIdFromToken('photo-001'), 'photo-001');
  for (const token of ['../private', 'photos/a.jpg', '@', 'https://example.com/a.jpg', '@a#crop']) {
    assert.throws(() => photoIdFromToken(token), /photo token/i);
  }
});

test('missing project assets fail with the slot and id rather than using a demo fallback', () => {
  const ids = new Set(['known']);
  assert.throws(() => validatePhotoTokens({ travel: '@known @missing' }, (id) => ids.has(id)), /travel.*missing/);
  assert.doesNotThrow(() => validatePhotoTokens({ travel: '@known', birthday: '' }, (id) => ids.has(id)));
});

test('empty optional story data does not resurrect default photos or personal copy', () => {
  const story = buildStory({}, {}, { endingBeats: 8 });
  assert.deepEqual(story.map((scene) => scene.kind), ['title', 'ending']);
  assert.equal(story.at(-1).b1, 16);
});

test('duration grows with photo pages and converts beat lengths to frames', () => {
  const minimal = { copy: {}, photos: {}, proposalFirst: true, endingBeats: 8, fps: 30, music: { trimBeforeSec: 0 } };
  assert.equal(calculateStoryMetadata(minimal, null).durationInFrames, 288);
  const expanded = calculateStoryMetadata({ ...minimal, photos: { travel: '@one|@two' } }, null);
  assert.equal(expanded.durationInFrames, 432);
  assert.equal(calculateStoryMetadata({ ...minimal, fps: 60 }, null).durationInFrames, 576);
});

test('trimmed music starts the beat clock on the next remaining downbeat', () => {
  const grid = { beats: Array.from({ length: 32 }, (_, i) => i * 0.5), downbeats: [0, 2, 4, 6, 8, 10, 12, 14] };
  const metadata = calculateStoryMetadata({ copy: {}, photos: {}, endingBeats: 8, fps: 30, music: { trimBeforeSec: 1 } }, grid);
  assert.equal(makeClock(metadata.beatGrid).at(0), 1);
  assert.equal(metadata.durationInFrames, 270);
});

test('short but valid measured grids retain their tempo instead of reverting to 100 BPM', () => {
  const clock = makeClock({ beats: [0.2, 0.95, 1.7], downbeats: [0.2] });
  assert.equal(clock.at(4), 3.2);
});

test('invalid timing input fails before renderer frame selection', () => {
  const base = { copy: {}, photos: {}, endingBeats: 8, fps: 30, music: { trimBeforeSec: 0 } };
  assert.throws(() => calculateStoryMetadata({ ...base, fps: 0 }, null), /fps/i);
  assert.throws(() => calculateStoryMetadata({ ...base, endingBeats: NaN }, null), /endingBeats/);
  assert.throws(() => calculateStoryMetadata(base, { beats: [0, 1, 0.5], downbeats: [0] }), /beat/i);
  assert.throws(() => calculateStoryMetadata({ ...base, music: { trimBeforeSec: 8 } }, { beats: [0, 1, 2, 3], downbeats: [0] }), /trim/i);
});
