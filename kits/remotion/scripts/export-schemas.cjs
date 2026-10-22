#!/usr/bin/env node
// Write each registered template's props as JSON Schema, generated from its zod schema, so the
// Python helper can validate inputs.json before npm ci or a render:
//   node scripts/export-schemas.cjs                      every template → schema/<id>.json
//   node scripts/export-schemas.cjs --check              exit 1 when a schema/<id>.json is stale
//   node scripts/export-schemas.cjs <id> <output.json>   one template, e.g. a project's schema/props.schema.json
// Format-dependent photo-slot minimums are refinements and are not in the JSON Schema; the
// catalog's formats[f].slots carries them and vvv.py validate checks photos from the catalog.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const kit = path.resolve(__dirname, '..');
const compile = (mod, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, resolveJsonModule: true },
  });
  mod._compile(outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const { z } = require('zod');
const { TEMPLATES } = require(path.join(kit, 'src/templates/registry.ts'));

/** The same conversion package-info.cjs uses for schema/props.schema.json in a .vvv package. */
const schemaFor = (id) => z.toJSONSchema(TEMPLATES[id].definition.schema, { unrepresentable: 'any', io: 'input' });
const text = (id) => JSON.stringify(schemaFor(id), null, 2) + '\n';

module.exports = { schemaFor, text, ids: () => Object.keys(TEMPLATES).sort() };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] !== '--check') {
    const [id, output] = args;
    if (!TEMPLATES[id]) {
      console.error(`UNKNOWN_TEMPLATE: ${id} is not in src/templates/registry.ts`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, text(id));
  } else if (args.length <= 1 && (args.length === 0 || args[0] === '--check')) {
    const stale = [];
    for (const id of module.exports.ids()) {
      const file = path.join(kit, 'schema', `${id}.json`);
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (current === text(id)) continue;
      if (args[0] === '--check') stale.push(`schema/${id}.json`);
      else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text(id));
      }
    }
    const dir = path.join(kit, 'schema');
    const known = new Set(module.exports.ids().map((id) => `${id}.json`));
    for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      if (name.endsWith('.json') && !known.has(name)) stale.push(`schema/${name} (no such template)`);
    }
    if (stale.length) {
      console.error(`SCHEMA_STALE: ${stale.join(', ')}; run npm run schemas.`);
      process.exit(1);
    }
  } else {
    console.error('usage: node scripts/export-schemas.cjs [--check | <template-id> <output.json>]');
    process.exit(2);
  }
}
