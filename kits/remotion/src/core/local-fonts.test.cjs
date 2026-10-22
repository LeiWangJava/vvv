const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (mod, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  mod._compile(outputText, filename);
};
const { selectFontFaces, localFont } = require('./local-fonts.ts');
const { fontFor } = require('./fonts.ts');

test('Chinese text loads its packaged bold glyph slice rather than all font subsets', () => {
  const selected = selectFontFaces('NotoSerifSC', 'normal', 700, '爱');
  assert.ok(selected.length > 0 && selected.length < 5);
  assert.ok(selected.every((face) => face.weight === '700' && face.file.startsWith('fonts/files/') && !face.file.includes('://')));
});

test('Latin italics and DV patched characters retain their actual font families', () => {
  assert.deepEqual(selectFontFaces('Lora', 'italic', 400, 'Love').map((face) => face.subset), ['latin']);
  assert.equal(localFont('KleeOne', '以么—', 600), 'Klee One');
  assert.ok(selectFontFaces('KleeOne', 'normal', 600, '以么—').length > 0);
  assert.match(fontFor('loraItalic', 'Love', 400), /^"Lora"/);
});

test('unconfigured families and shared-kit aliases fail explicitly', () => {
  assert.throws(() => localFont('Unpackaged', 'text'), /not packaged/);
  assert.throws(() => fontFor('xiaowei', '文字'), /not configured/);
});
