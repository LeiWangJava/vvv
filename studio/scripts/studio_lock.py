#!/usr/bin/env python3
"""Template lock: prove a project still is the template, with only photos and allowed text filled in.

    python studio_lock.py --project PROJECT --template TEMPLATE.vvv

Daily production may only change which photos go where (inputs.json props.photos, assets.json,
public/photos/) and the milestone captions / copy text. Everything that makes the template look and
sound the way it does must stay byte for byte as packaged: source code, stickers and decorations
(public/assets), fonts, music files and beat maps, scripts, config. In inputs.json, music, fps and
format must equal the template's defaults.

Prints one JSON object; exits 1 when the project departs from the template.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

# Paths whose files must equal the package exactly; photos are the one thing production adds.
LOCKED_PREFIXES = ('src/', 'public/', 'scripts/', 'catalog/', 'schema/')
LOCKED_FILES = ('package.json', 'package-lock.json', 'remotion.config.ts', 'tsconfig.json', 'font-sources.json')
FREE_PREFIXES = ('public/photos/',)
SKIP_DIRS = {'node_modules', 'build', 'out', '.git', '__pycache__'}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def locked(rel: str) -> bool:
    if rel.startswith(FREE_PREFIXES):
        return False
    return rel.startswith(LOCKED_PREFIXES) or rel in LOCKED_FILES


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--project', required=True, type=Path)
    ap.add_argument('--template', required=True, type=Path, help='the .vvv package the project was made from')
    a = ap.parse_args()
    project = a.project.resolve()
    with zipfile.ZipFile(a.template) as z:
        manifest = json.loads(z.read('vvv.json'))
        integrity = json.loads(z.read('integrity.json'))['files']
        template_id = manifest['template']['id']
        catalog = json.loads(z.read(f'catalog/{template_id}.json'))
    errors, warnings, info = [], [], []

    inputs = json.loads((project / 'inputs.json').read_text(encoding='utf-8'))
    if inputs.get('template') != template_id:
        errors.append(f"工程用的模板是 {inputs.get('template')}，不是 {template_id}")

    # 1. files: everything locked must match the package byte for byte, nothing locked may be added
    expected = {rel: meta['sha256'] for rel, meta in integrity.items() if locked(rel)}
    for rel, digest in sorted(expected.items()):
        path = project / rel
        if not path.is_file():
            errors.append(f'缺少模板文件 {rel}')
        elif sha(path) != digest:
            errors.append(f'模板文件被改动：{rel}')
    for path in sorted(project.rglob('*')):
        if not path.is_file() or any(part in SKIP_DIRS for part in path.relative_to(project).parts):
            continue
        rel = path.relative_to(project).as_posix()
        if locked(rel) and rel not in expected and rel != 'schema/props.schema.json':
            errors.append(f'模板里多出了文件：{rel}（贴图、配乐、代码只能用模板自带的）')

    # 2. inputs.json: look and sound settings must equal the template defaults
    props, defaults = inputs.get('props', {}), catalog['defaultProps']
    if props.get('music') != defaults.get('music'):
        errors.append(f"背景音乐被改动：{props.get('music')}，模板是 {defaults.get('music')}")
    if props.get('fps', defaults.get('fps')) != defaults.get('fps'):
        errors.append(f"帧率被改成 {props.get('fps')}，模板是 {defaults.get('fps')}")
    fmt = props.get('format', catalog['defaultFormat'])
    if fmt not in catalog['formats']:
        errors.append(f'画幅 {fmt} 不是模板支持的 {list(catalog["formats"])}')
    for key in props:
        if key in ('photos', 'copy', 'captions', 'music', 'fps', 'format', 'beatGrid'):
            continue
        if key not in defaults:
            errors.append(f'inputs.json 里多了模板没有的设置：{key}')
        elif props[key] != defaults[key]:
            errors.append(f'模板设置被改动：{key}')

    # 3. text: allowed, but every change from the template's own wording is listed for the person to see
    for field, text in (props.get('copy') or {}).items():
        if field not in (defaults.get('copy') or {}):
            errors.append(f'copy 里多了模板没有的文字位：{field}')
        elif text != defaults['copy'][field]:
            info.append(f'文字 {field} 已改成客户内容：{text[:30]}{"…" if len(text) > 30 else ""}')
    if 'title' in (props.get('copy') or {}) and props['copy']['title'] != defaults.get('copy', {}).get('title'):
        warnings.append('片头标题改了模板原文，请确认客户要求过')

    # 4. photos: generated images are flagged so a person can see them
    assets = json.loads((project / 'assets.json').read_text(encoding='utf-8'))
    generated = [i['id'] for i in assets.get('items', []) if 'ai-generated' in (i.get('processing') or [])]
    used = {pid for v in (props.get('photos') or {}).values() for pid in (v if isinstance(v, list) else [v]) if pid}
    gen_used = sorted(set(generated) & used)
    if gen_used:
        warnings.append(f'片中用了 {len(gen_used)} 张 AI 生成图：{gen_used}；只有用户明确要求时才允许')

    status = 'failed' if errors else 'passed'
    print(json.dumps({'status': status, 'template': template_id, 'lockedFiles': len(expected),
                      'errors': errors, 'warnings': warnings, 'textChanges': info,
                      'next': {'action': 'fix', 'hint': '把被改动的模板文件和设置恢复成模板原样（从 .vvv 重新解出对应文件），只保留照片和文字的改动'}
                      if errors else {'action': 'continue', 'hint': '模板完整，可以渲染'}}, ensure_ascii=False, indent=2))
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
