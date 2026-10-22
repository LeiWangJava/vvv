#!/usr/bin/env node
// What a single-template .vvv package needs from this kit, as JSON on stdout:
//   node scripts/package-info.cjs <template-id> [extra-props.json ...]
// - registry: src/templates/registry.ts reduced to this template's entry
// - code: kit files reachable by import from src/index.tsx with that registry, plus the template folder
// - fontModules: local font families named by string literals in that code or in the props
// - publicPrefixes: public/ path heads ("assets/xy62/", "sfx/dvstory-key-") named in that code
// - schema: the template's props as JSON Schema (zod), for agents that edit inputs.json
// Never renders or fetches anything; the Python packer decides which files to copy.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const kit = path.resolve(__dirname, '..');
const [id, ...propFiles] = process.argv.slice(2);
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('usage: node scripts/package-info.cjs <template-id> [props.json ...]');
  process.exit(2);
}

// --- the reduced registry ---------------------------------------------------------------
const registryPath = path.join(kit, 'src/templates/registry.ts');
const registryText = fs.readFileSync(registryPath, 'utf8');
const entry = registryText.match(new RegExp(`^\\s*'?${id}'?:\\s*\\{\\s*definition:\\s*(\\w+),\\s*catalog:\\s*(\\w+)\\s*\\},?\\s*$`, 'm'));
if (!entry) {
  console.error(`UNKNOWN_TEMPLATE: ${id} is not in src/templates/registry.ts`);
  process.exit(1);
}
const [, definitionName, catalogName] = entry;
const lines = registryText.split('\n');
const kept = lines.filter((line) => {
  const imported = line.match(/^import (?:type )?(?:\{\s*([\w, ]+)\s*\}|(\w+)) from /);
  if (!imported) return true;
  const names = (imported[1] || imported[2]).split(',').map((name) => name.trim());
  return names.includes(definitionName) || names.includes(catalogName) || line.startsWith('import type');
});
const start = kept.findIndex((line) => line.includes('export const TEMPLATES'));
const end = kept.findIndex((line, index) => index > start && line.startsWith('};'));
const registry = [...kept.slice(0, start + 1), `  '${id}': { definition: ${definitionName}, catalog: ${catalogName} },`, ...kept.slice(end)].join('\n');

// --- reachable code ---------------------------------------------------------------------
const exts = ['', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '/index.ts', '/index.tsx'];
const resolve = (from, spec) => {
  for (const ext of exts) {
    const candidate = path.resolve(path.dirname(from), spec + ext);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve ${spec} from ${path.relative(kit, from)}`);
};
const seen = new Set();
const textOf = (file) => (file === registryPath ? registry : fs.readFileSync(file, 'utf8'));
const visit = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  if (!/\.(tsx?|mjs|cjs|js)$/.test(file)) return;
  for (const imported of ts.preProcessFile(textOf(file), true, true).importedFiles) {
    if (imported.fileName.startsWith('.')) visit(resolve(file, imported.fileName));
  }
};
visit(path.join(kit, 'src/index.tsx'));

const catalogFile = path.join(kit, 'catalog', `${id}.json`);
const templateDirs = [...seen]
  .filter((file) => file.startsWith(path.join(kit, 'src/templates') + path.sep))
  .map((file) => path.relative(path.join(kit, 'src/templates'), file).split(path.sep)[0])
  .filter((dir) => !dir.includes('.'));
const ownDir = [...new Set(templateDirs)].find((dir) => fs.existsSync(path.join(kit, 'src/templates', dir, 'index.tsx')) &&
  textOf(registryPath).includes(`from './${dir}'`));
if (ownDir) {
  // The whole folder travels: README, timing notes and calibration data that are not imported.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full);
    else if (d.isFile() && d.name !== '.DS_Store' && !/\.test\.(cjs|mjs|ts)$/.test(d.name)) seen.add(full);
  });
  walk(path.join(kit, 'src/templates', ownDir));
}
// Effects travel as whole folders too, whether this package is the effect or a template that uses it.
const effectsRoot = path.join(kit, 'src/effects') + path.sep;
const effectDirs = new Set([...seen].filter((file) => file.startsWith(effectsRoot))
  .map((file) => path.relative(effectsRoot, file).split(path.sep)[0]));
for (const dir of effectDirs) {
  const walk = (folder) => fs.readdirSync(folder, { withFileTypes: true }).forEach((d) => {
    const full = path.join(folder, d.name);
    if (d.isDirectory()) walk(full);
    // An effect's demo travels only in the effect's own package, where the registry already reaches it.
    else if (d.isFile() && d.name !== '.DS_Store' && d.name !== 'demo.tsx' && !/\.test\.(cjs|mjs|ts)$/.test(d.name)) seen.add(full);
  });
  walk(path.join(effectsRoot, dir));
}
seen.add(catalogFile);
const code = [...seen].map((file) => path.relative(kit, file).split(path.sep).join('/')).sort();

// --- string literals: fonts and public prefixes -----------------------------------------
const literals = new Set();
// Font alias tables (`const F = { songB: ["songti", 700], … }` in the shared kit) name every face they can
// map to; their entries count only when code uses the alias.
const aliasTables = { [path.join(kit, 'src/templates/shared/kit.tsx')]: 'F' };
const aliases = {};
const collect = (file) => {
  const source = ts.createSourceFile(file, textOf(file), ts.ScriptTarget.Latest, true);
  const walk = (node) => {
    if (ts.isVariableDeclaration(node) && aliasTables[file] && node.name.getText(source) === aliasTables[file]) {
      const table = node.initializer && ts.isSatisfiesExpression(node.initializer) ? node.initializer.expression : node.initializer;
      const object = table && ts.isAsExpression(table) ? table.expression : table;
      if (object && ts.isObjectLiteralExpression(object)) {
        for (const prop of object.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isArrayLiteralExpression(prop.initializer) && ts.isStringLiteral(prop.initializer.elements[0])) {
            aliases[prop.name.getText(source)] = prop.initializer.elements[0].text;
          }
        }
        return;
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.add(node.text);
    else if (ts.isTemplateExpression(node)) literals.add(node.head.text);
    ts.forEachChild(node, walk);
  };
  walk(source);
};
// The font tables name every family; only their callers say which ones a template uses.
const fontTables = ['src/core/fonts.ts', 'src/core/local-fonts.ts'].map((file) => path.join(kit, file));
[...seen].filter((file) => /\.(tsx?|mjs|cjs|js)$/.test(file) && !fontTables.includes(file)).forEach(collect);
const collectValues = (value) => {
  if (typeof value === 'string') literals.add(value);
  else if (Array.isArray(value)) value.forEach(collectValues);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectValues);
};
collectValues(JSON.parse(fs.readFileSync(catalogFile, 'utf8')).defaultProps);
propFiles.forEach((file) => collectValues(JSON.parse(fs.readFileSync(file, 'utf8'))));

const fontsText = fs.readFileSync(path.join(kit, 'src/core/fonts.ts'), 'utf8');
const defs = {};
for (const match of fontsText.matchAll(/^\s*(\w+):\s*\{\s*module:\s*"(\w+)"/gm)) defs[match[1]] = match[2];
const modules = JSON.parse(fs.readFileSync(path.join(kit, 'font-sources.json'), 'utf8')).families.map((family) => family.module);
const fontModules = new Set();
for (const literal of literals) {
  if (aliases[literal] && defs[aliases[literal]]) fontModules.add(defs[aliases[literal]]);
  if (defs[literal]) fontModules.add(defs[literal]);
  if (modules.includes(literal)) fontModules.add(literal);
}

const publicPrefixes = [...literals]
  .filter((literal) => /^(assets|sfx|vo)\/[A-Za-z0-9]/.test(literal))
  .sort();

// --- props schema -----------------------------------------------------------------------
const compile = (mod, filename) => {
  const text = filename === registryPath ? registry : fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, resolveJsonModule: true },
  });
  mod._compile(outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;
const { z } = require('zod');
const { TEMPLATES } = require(path.join(kit, 'src/templates/registry.ts'));
const schema = z.toJSONSchema(TEMPLATES[id].definition.schema, { unrepresentable: 'any', io: 'input' });

process.stdout.write(JSON.stringify({ template: id, registry, code, effects: [...effectDirs].sort(), fontModules: [...fontModules].sort(), publicPrefixes, schema }, null, 2) + '\n');
