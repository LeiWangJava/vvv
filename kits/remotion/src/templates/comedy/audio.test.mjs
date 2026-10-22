import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = (mod, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  });
  mod._compile(outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Stub only the browser-facing Remotion leaf; Track and Cues use their real volume callbacks.
const remotion = require('remotion');
const played = [];
const browserless = { ...remotion,
  Audio: (props) => { played.push({ src: props.src, trimBefore: props.trimBefore, volume: props.volume(15) }); return null; },
  Sequence: ({ children }) => children,
  useVideoConfig: () => ({ fps: 30 }),
};
const originalLoad = Module._load;
Module._load = function (id, ...args) { return id === 'remotion' ? browserless : originalLoad.call(this, id, ...args); };
const { AudioGain, Track, Cues } = require('../../components/Music.tsx');
const { ComedyAudio } = require('./index.tsx');
Module._load = originalLoad;

test('Comedy applies headroom and outer fades to actual music, effect and clip sources before mixing', () => {
  played.length = 0;
  renderToStaticMarkup(React.createElement(AudioGain.Provider, { value: (frame) => Math.min(1, frame / 120) },
    React.createElement(ComedyAudio, null,
      React.createElement(Track, { track: { src: 'music.mp3', from: 2, until: 12, volume: 0.75, fadeInSec: 0.1 }, duck: () => 0.4 }),
      React.createElement(Cues, { cues: [
        { src: 'effect.wav', at: 3, volume: 0.9 },
        { src: 'clip.mp4', at: 4, volume: 2.2, trimBeforeSec: 2.5, seconds: 3 },
      ] }))));
  assert.equal(played.length, 3);
  // Frame 15 of each sound corresponds to template frame 75 / 105 / 135, respectively.
  assert.ok(Math.abs(played[0].volume - 0.09375) < 1e-12, 'music retains its duck and template-frame fade before mixing');
  assert.ok(Math.abs(played[1].volume - 0.39375) < 1e-12, 'the one-shot receives the same master headroom');
  assert.ok(Math.abs(played[2].volume - 1.1) < 1e-12, 'clip gain is attenuated before the mixer sums it');
  assert.equal(played[2].trimBefore, 75, 'clip trim remains independent from the timeline gain');
});

test('Comedy headroom composes with the surrounding loop fade at the original template frame', () => {
  assert.equal(typeof ComedyAudio, 'function', 'Comedy needs a gain bus around its source tracks and cues');
  const frames = [0, 15, 30, 60];
  const seen = [];
  const Probe = () => { const gain = React.useContext(AudioGain); seen.push(...frames.map(gain)); return null; };
  renderToStaticMarkup(React.createElement(AudioGain.Provider, { value: (frame) => Math.min(1, frame / 30) },
    React.createElement(ComedyAudio, null, React.createElement(Probe))));
  assert.deepEqual(seen, [0, 0.25, 0.5, 0.5]);
});
