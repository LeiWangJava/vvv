#!/usr/bin/env python3
"""Generate the client questionnaires (.docx with clickable checkboxes, and a WeChat text version).

    python build_questionnaires.py OUTDIR
Needs Node.js with the `docx` npm package for the Word files.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from questionnaires import ALL  # noqa: E402

HERE = Path(__file__).resolve().parent


def wechat_text(q: dict) -> str:
    out = [q['title'], '', q['intro'], '',
           '填写方法：长按复制全文，在冒号后面直接填写；选择题在"答："后面填选项序号（多选就写多个，例如 1、3），填完发回给我们即可。', '']
    for heading, items in q['sections']:
        out += ['', f'【{heading}】', '']
        for item in items:
            kind = item[0]
            if kind == 'field':
                out.append(f'{item[1]}：')
            elif kind == 'choice':
                out.append(f'{item[1]}')
                out += [f'  {i}. {o}' for i, o in enumerate(item[2], 1)]
                out.append('答：')
            elif kind == 'note':
                out.append(item[1])
            elif kind == 'table':
                cols, example, rows = item[1], item[2], item[3]
                out.append('格式：' + '｜'.join(cols))
                out.append('例：' + '｜'.join(example))
                out += [f'{i}. ' for i in range(1, min(rows, 5) + 1)]
                out.append('（不够可以继续往下写）')
            elif kind == 'text':
                out += [f'{item[1]}：', '']
            elif kind == 'photos':
                for cat, count, note in item[1]:
                    out.append(f'· {cat}：{count}' + (f'（{note}）' if note else ''))
            elif kind == 'consent':
                out.append('以下每项请在冒号后回答"同意"或"不同意"：')
                out += [f'{i}. {c}：' for i, c in enumerate(item[1], 1)]
            out.append('')
    return '\n'.join(line.rstrip() for line in out).replace('\n\n\n', '\n\n').strip() + '\n'


def main() -> None:
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    for q in ALL:
        name = q['file'].replace('与照片清单', '') + '-微信版.txt'
        (outdir / name).write_text(wechat_text(q).replace('\n', '\r\n'), encoding='utf-8-sig')
    spec = outdir / '.questionnaires.json'
    spec.write_text(json.dumps(ALL, ensure_ascii=False), encoding='utf-8')
    subprocess.run(['node', str(HERE / 'build_docx.cjs'), str(spec), str(outdir)], check=True, env=os.environ)
    spec.unlink()
    print('\n'.join(sorted(p.name for p in outdir.iterdir())))


if __name__ == '__main__':
    main()
