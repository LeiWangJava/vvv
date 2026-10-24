// Build Word questionnaires with clickable checkboxes and fill-in cells from questionnaires.py data.
//   node build_docx.cjs SPEC.json OUTDIR
const fs = require('fs');
const path = require('path');
const {
  AlignmentType, BorderStyle, CheckBox, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, WidthType, HeightRule, VerticalAlign,
} = require('docx');

const [, , specPath, outDir] = process.argv;
const ALL = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const FONT = { ascii: 'Microsoft YaHei', hAnsi: 'Microsoft YaHei', eastAsia: 'Microsoft YaHei', cs: 'Microsoft YaHei' };
const CONTENT = 9638; // A4 width minus 2 cm margins, DXA
const GREY = 'F2F2F2';
const LINE = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };

const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: 22, ...opts });
const para = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 80 }, ...opts });
const box = () => new CheckBox({
  checked: false,
  checkedState: { value: '2611', font: 'Segoe UI Symbol' },
  uncheckedState: { value: '2610', font: 'Segoe UI Symbol' },
});
const cell = (children, width, opts = {}) => new TableCell({
  children: Array.isArray(children) ? children : [children],
  width: { size: width, type: WidthType.DXA }, borders: BORDERS, verticalAlign: VerticalAlign.CENTER,
  margins: { top: 60, bottom: 60, left: 100, right: 100 }, ...opts,
});
const table = (widths, rows) => new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: widths, rows });
const spacer = () => para(run(''), { spacing: { after: 120 } });

function fields(list) {
  const w = [3400, CONTENT - 3400];
  return table(w, list.map((label) => new TableRow({
    height: { value: 520, rule: HeightRule.ATLEAST },
    children: [
      cell(para(run(label)), w[0], { shading: { type: ShadingType.CLEAR, color: 'auto', fill: GREY } }),
      cell(para(run('')), w[1]),
    ],
  })));
}

function render(item) {
  const [kind] = item;
  if (kind === 'note') return [para(run(item[1], { color: '595959', size: 20 }))];
  if (kind === 'choice') {
    const label = para(run(item[1], { bold: true }));
    // Short options sit on one line; long ones get a line each so none breaks across lines.
    if (item[2].join('').length > 24) {
      return [label, ...item[2].map((o, i) => para([box(), run(' ' + o)], { spacing: { after: i === item[2].length - 1 ? 160 : 60 } }))];
    }
    const options = [];
    item[2].forEach((o, i) => { if (i) options.push(run('      ')); options.push(box(), run(' ' + o)); });
    return [label, para(options, { spacing: { after: 160 } })];
  }
  if (kind === 'consent') {
    return item[1].map((c) => para([box(), run(' ' + c)], { spacing: { after: 100 } }));
  }
  if (kind === 'table') {
    const [, cols, example, n] = item;
    const w = [1900, CONTENT - 1900 - 2700, 2700];
    const header = new TableRow({ tableHeader: true, children: cols.map((c, i) => cell(para(run(c, { bold: true })), w[i], { shading: { type: ShadingType.CLEAR, color: 'auto', fill: GREY } })) });
    const ex = new TableRow({ children: example.map((c, i) => cell(para(run((i === 0 ? '例：' : '') + c, { color: '8C8C8C', italics: true })), w[i])) });
    const blank = Array.from({ length: n }, () => new TableRow({ height: { value: 480, rule: HeightRule.ATLEAST }, children: w.map((x) => cell(para(run('')), x)) }));
    return [table(w, [header, ex, ...blank]), spacer()];
  }
  if (kind === 'text') {
    return [para(run(item[1], { bold: true })), table([CONTENT], [new TableRow({ height: { value: 400 * item[2], rule: HeightRule.ATLEAST }, children: [cell(para(run('')), CONTENT)] })]), spacer()];
  }
  if (kind === 'photos') {
    const w = [4200, 1700, CONTENT - 4200 - 1700];
    const head = new TableRow({ tableHeader: true, children: ['类别', '建议数量', '说明'].map((c, i) => cell(para(run(c, { bold: true })), w[i], { shading: { type: ShadingType.CLEAR, color: 'auto', fill: GREY } })) });
    const rows = item[1].map((r) => new TableRow({ children: r.map((c, i) => cell(para(run(c, { size: 21 })), w[i])) }));
    return [table(w, [head, ...rows]), spacer()];
  }
  throw new Error('unknown item ' + kind);
}

function section(heading, items) {
  const out = [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(heading, { size: 28, bold: true, color: '1F1F1F' })], spacing: { before: 360, after: 160 } })];
  let pending = [];
  const flush = () => { if (pending.length) { out.push(fields(pending), spacer()); pending = []; } };
  for (const item of items) {
    if (item[0] === 'field') { pending.push(item[1]); continue; }
    flush();
    out.push(...render(item));
  }
  flush();
  return out;
}

(async () => {
  for (const q of ALL) {
    const children = [
      new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [run(q.title, { size: 36, bold: true })], spacing: { after: 200 } }),
      para(run(q.intro)),
      para(run('填写方法：在灰色格子右边的空格里填写；选择题点一下方框即可打勾（电脑上的 Word 或 WPS）。手机上不方便勾选时，用同名的文字版，复制到微信里填写发回。', { color: '595959', size: 20 }), { spacing: { after: 200 } }),
    ];
    for (const [heading, items] of q.sections) children.push(...section(heading, items));
    const doc = new Document({
      styles: { default: { document: { run: { font: FONT, size: 22 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
    });
    fs.writeFileSync(path.join(outDir, `${q.file}.docx`), await Packer.toBuffer(doc));
  }
})().catch((e) => { console.error(e); process.exit(1); });
