#!/usr/bin/env python3
"""Slot filling helpers for a studio order: rank candidates, check a casting, apply it to a VVV project.

    python studio_cast.py candidates --cards growth.slots.json --photos photos.json [--brief brief.json] --out candidates.json
    python studio_cast.py check      --cards growth.slots.json --photos photos.json --casting casting.json [--brief brief.json] [--catalog catalog/growth.json]
    python studio_cast.py apply      --cards growth.slots.json --casting casting.json --project PROJECT [--photos photos.json]

The agent (GPT / Codex) decides what goes where and writes casting.json; these commands only narrow the choice
and refuse hard errors. Every command prints one JSON object. `check` exits 1 when it finds an error.
Stdlib only (jsonschema is used for schema validation when installed).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = HERE.parent / 'spec'
BAD_FLAGS = {'blurry', 'screenshot', 'watermark', 'low-res', 'heavy-filter'}
SLOT_KEY = re.compile(r'^(?P<name>[A-Za-z][\w-]*)(\[(?P<index>\d+)\])?$')
WEIGHTS = {'scene': 0.30, 'people': 0.20, 'phase': 0.15, 'quality': 0.15, 'semantic': 0.10, 'crop': 0.10}


def load(path: Path | None):
    return json.loads(Path(path).read_text(encoding='utf-8')) if path else None


def out(obj, code: int = 0) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2))
    sys.exit(code)


def vocabulary():
    voc = load(SPEC / 'vocabulary.json')
    groups = {g['id']: set(g['members']) for g in voc['roleGroups']}
    min_px = {d['id']: d['minShortSidePx'] for d in voc['displaySizes']}
    return voc, groups, min_px


def has_role(people: list[str], role: str, groups: dict[str, set[str]]) -> bool:
    if role in groups:
        members = groups[role]
        return members.issubset(set(people)) if role != 'family' else len(people) >= 3
    return role in people


def schema_check(document, schema_name: str) -> list[str]:
    try:
        import jsonschema  # type: ignore
    except ImportError:
        return []
    validator = jsonschema.Draft202012Validator(load(SPEC / schema_name))
    return [f"{'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message}" for e in validator.iter_errors(document)]


def bigrams(text: str) -> set[str]:
    text = re.sub(r'\s+', '', text or '')
    return {text[i:i + 2] for i in range(len(text) - 1)}


def score(card: dict, photo: dict, groups, min_px, slot_copy: str = '') -> tuple[float, list[str]] | None:
    """Return (score 0–1, reasons) or None when a hard rule rules the photo out."""
    if BAD_FLAGS & set(photo.get('flags', [])):
        return None
    disp, ppl = card['display'], card.get('people', {})
    if min(photo['width'], photo['height']) < min_px.get(disp['size'], 0) * 0.5:
        return None
    people = photo.get('people') or []
    labelled = bool(people) or photo.get('shot') is not None
    for role in ppl.get('forbid', []):
        if labelled and has_role(people, role, groups):
            return None
    if labelled:
        for role in ppl.get('require', []):
            if not has_role(people, role, groups):
                return None
        if not people and not ppl.get('allowNone', False):
            return None
        lo_hi = ppl.get('count')
        if lo_hi and people and not (lo_hi[0] <= len(people) <= lo_hi[1]):
            return None
    for avoid in card.get('scenes', {}).get('avoid', []):
        if avoid in photo.get('scenes', []):
            return None
    why, parts = [], {}
    prefer = card.get('scenes', {}).get('prefer', [])
    hit = sorted(set(prefer) & set(photo.get('scenes', [])))
    parts['scene'] = 1.0 if hit else (0.5 if not prefer else 0.0)
    if hit:
        why.append('场景:' + ','.join(hit))
    pref_roles = ppl.get('prefer', []) + ppl.get('require', [])
    role_ok = any(has_role(people, r, groups) for r in pref_roles) if pref_roles else True
    shot_ok = (not card.get('shots')) or photo.get('shot') in card.get('shots', [])
    parts['people'] = 0.5 * role_ok + 0.5 * shot_ok if labelled else 0.3
    phases = card.get('phase', {}).get('prefer', [])
    parts['phase'] = 1.0 if photo.get('phase') in phases else (0.5 if not phases else 0.0)
    if photo.get('phase') in phases:
        why.append('阶段:' + photo['phase'])
    parts['quality'] = min(1.0, photo.get('sharpness', 0) / 20.0)
    target = ' '.join([card.get('label', ''), card.get('note', ''), slot_copy])
    a, b = bigrams(photo.get('caption', '')), bigrams(target)
    parts['semantic'] = len(a & b) / max(1, len(a | b)) * 4 if a and b else 0.0
    parts['semantic'] = min(1.0, parts['semantic'])
    aspect = photo['width'] / photo['height']
    lo, hi = disp['aspect']
    inside = lo <= aspect <= hi
    parts['crop'] = 1.0 if inside else max(0.0, 1 - abs(aspect - (lo if aspect < lo else hi)) / max(aspect, lo))
    if not labelled:
        why.append('未标注内容')
    total = sum(WEIGHTS[k] * v for k, v in parts.items())
    return round(total, 3), why


def expand(card_name: str, casting_slots: dict) -> list[tuple[str, int | None, dict]]:
    rows = []
    for key, value in casting_slots.items():
        m = SLOT_KEY.match(key)
        if m and m['name'] == card_name:
            rows.append((key, int(m['index']) if m['index'] is not None else None, value))
    return sorted(rows, key=lambda r: -1 if r[1] is None else r[1])


def cmd_candidates(a) -> None:
    cards, photos, brief = load(a.cards), load(a.photos), load(a.brief)
    _, groups, min_px = vocabulary()
    banned = set((brief or {}).get('photos', {}).get('doNotUse', []))
    result = {}
    for name, card in cards['slots'].items():
        ranked = []
        for p in photos['photos']:
            if p['id'] in banned or p['file'] in banned:
                continue
            s = score(card, p, groups, min_px)
            if s:
                ranked.append({'photo': p['id'], 'index': p.get('index'), 'file': p['file'], 'score': s[0], 'why': s[1]})
        ranked.sort(key=lambda r: -r['score'])
        result[name] = {'label': card['label'], 'priority': card.get('priority', 3), 'top': ranked[:a.top],
                        'eligible': len(ranked)}
    Path(a.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    out({'status': 'ranked', 'out': str(a.out),
         'slots': {k: {'eligible': v['eligible'], 'best': v['top'][0]['photo'] if v['top'] else None} for k, v in result.items()}})


def crop_ok(photo: dict, card: dict) -> bool | None:
    faces = photo.get('faces') or []
    zone = card['display'].get('faceZone')
    if not faces or not zone:
        return None
    w, h = photo['width'], photo['height']
    lo, hi = card['display']['aspect']
    aspect = min(max(w / h, lo), hi)
    # centred cover crop of the photo to the slot aspect (the renderer shifts toward faces, so this is the worst case)
    cw, ch = (h * aspect, h) if w / h > aspect else (w, w / aspect)
    x0, y0 = (w - cw) / 2 / w, (h - ch) / 2 / h
    sx, sy = cw / w, ch / h
    for fx, fy, fw, fh in faces:
        cx, cy = (fx + fw / 2 - x0) / sx, (fy + fh / 2 - y0) / sy
        if not (zone[0] <= cx <= zone[2] and zone[1] <= cy <= zone[3]):
            return False
    return True


def cmd_check(a) -> None:
    cards, photos, casting, brief = load(a.cards), load(a.photos), load(a.casting), load(a.brief)
    catalog = load(a.catalog)
    _, groups, min_px = vocabulary()
    by_id = {p['id']: p for p in photos['photos']}
    by_file = {p['file']: p['id'] for p in photos['photos']}
    errors, warnings = [], []
    errors += [f'casting 格式: {m}' for m in schema_check(casting, 'casting.schema.json')]
    errors += [f'需求卡格式: {m}' for m in schema_check(cards, 'slot-card.schema.json')]
    if brief:
        errors += [f'需求表格式: {m}' for m in schema_check(brief, 'brief.schema.json')]
    consent = (brief or {}).get('consent', {})
    event = (brief or {}).get('event') or photos.get('event')
    used: dict[str, list[str]] = {}

    known = set(cards['slots'])
    for key in casting['slots']:
        m = SLOT_KEY.match(key)
        if not m or m['name'] not in known:
            errors.append(f'{key}: 需求卡里没有这个坑位')

    for name, card in cards['slots'].items():
        rows = expand(name, casting['slots'])
        if catalog and name in catalog.get('slots', {}):
            spec = catalog['slots'][name]
            if spec['kind'] == 'array':
                lo, hi = spec.get('min', 0), spec.get('max', spec.get('count', 0))
                if not lo <= len(rows) <= hi:
                    errors.append(f'{name}: 需要 {lo}–{hi} 张，填了 {len(rows)} 张')
            elif not rows:
                errors.append(f'{name}: 没有填')
        gen_mode = card.get('generation', {}).get('mode', 'none')
        prev = None
        times = []
        group_count: dict[int, int] = {}
        for key, index, entry in rows:
            src = entry['source']
            if src.startswith('generated') or src == 'stylized':
                allowed = {'generated-decor': ('decor', 'fill', 'stylize'), 'generated-fill': ('fill', 'stylize'),
                           'stylized': ('stylize',)}[src]
                if gen_mode not in allowed:
                    errors.append(f'{key}: 这个坑位不允许 {src}（生图等级 {gen_mode}）')
                if src == 'stylized' and not consent.get('aiStylize'):
                    errors.append(f'{key}: 客户没有授权 AI 画风重绘')
                gen = entry.get('generated') or {}
                if not gen.get('file') or not Path(gen['file']).exists():
                    errors.append(f'{key}: 生成图文件不存在')
                if src != 'stylized':
                    prev = None
                    continue
            pid = entry.get('photo')
            photo = by_id.get(pid)
            if not photo:
                errors.append(f'{key}: 照片 {pid} 不在 photos.json 里')
                continue
            used.setdefault(pid, []).append(key)
            if BAD_FLAGS & set(photo.get('flags', [])):
                errors.append(f"{key}: 照片有质量问题 {sorted(BAD_FLAGS & set(photo['flags']))}")
            need = min_px.get(card['display']['size'], 0)
            if min(photo['width'], photo['height']) < need:
                (errors if min(photo['width'], photo['height']) < need * 0.5 else warnings).append(
                    f"{key}: 短边 {min(photo['width'], photo['height'])}px，{card['display']['size']} 建议 ≥ {need}px")
            people = photo.get('people') or []
            if not people and photo.get('shot') is None:
                warnings.append(f'{key}: 照片内容还没标注，身份规则没法检查')
            else:
                for role in card['people'].get('require', []):
                    if not has_role(people, role, groups):
                        errors.append(f'{key}: 坑位要求 {role}，照片里是 {people or "无人"}')
                for role in card['people'].get('forbid', []):
                    if has_role(people, role, groups):
                        errors.append(f'{key}: 坑位禁止 {role}')
            ok = crop_ok(photo, card)
            if ok is False:
                errors.append(f'{key}: 按坑位比例裁切后人脸会被切掉或贴边')
            if card.get('distinctNeighbors', True) and prev and photo.get('dupGroup') and photo['dupGroup'] == prev.get('dupGroup'):
                errors.append(f'{key}: 和前一格是近似重复照片')
            if photo.get('dupGroup'):
                group_count[photo['dupGroup']] = group_count.get(photo['dupGroup'], 0) + 1
            if photo.get('takenAt'):
                times.append((key, photo['takenAt']))
            prev = photo
            copy_cfg = card.get('copy')
            text = entry.get('copy', '')
            if copy_cfg and text:
                lines = text.split('\n')
                if len(lines) > copy_cfg.get('maxLines', 99) or len(text.replace('\n', '')) > copy_cfg.get('maxChars', 999):
                    errors.append(f"{key}: 文字超长（上限 {copy_cfg.get('maxChars')} 字 / {copy_cfg.get('maxLines')} 行）")
            if text and entry.get('copySource') == 'drafted':
                warnings.append(f'{key}: 文案由 GPT 起草，需要确认')
            if entry.get('confidence') == 'low':
                warnings.append(f'{key}: 置信度低，复核时优先看')
        if card.get('phase', {}).get('order') == 'chronological':
            for (k1, t1), (k2, t2) in zip(times, times[1:]):
                if t2 < t1:
                    errors.append(f'{k2}: 拍摄时间 {t2[:10]} 早于前一格 {k1} 的 {t1[:10]}，应按时间排序')
        limit = 2 if event == 'full-month' else 3
        for g, n in group_count.items():
            if n > limit:
                errors.append(f'{name}: 同一组近似照片用了 {n} 张（上限 {limit}）')

    reuse = {name: card.get('reuse', 'never') for name, card in cards['slots'].items()}
    for pid, keys in used.items():
        strict = [k for k in keys if reuse[SLOT_KEY.match(k)['name']] == 'never']
        if len(strict) > 1:
            errors.append(f'{pid}: 同一张照片出现在多个不允许复用的位置 {strict}')
        for name in {SLOT_KEY.match(k)['name'] for k in keys}:
            inside = [k for k in keys if SLOT_KEY.match(k)['name'] == name]
            if reuse[name] == 'section' and len(inside) > 1:
                errors.append(f'{pid}: 在 {name} 段内重复使用 {inside}')

    if brief:
        prefs = brief.get('photos', {})
        must = {by_file.get(x, x) for x in prefs.get('mustUse', [])}
        for pid in must - set(used):
            errors.append(f'必用照片 {pid} 没有用上')
        for x in prefs.get('doNotUse', []):
            if by_file.get(x, x) in used:
                errors.append(f'禁用照片 {x} 被用了')
    status = 'failed' if errors else 'passed'
    out({'status': status, 'errors': errors, 'warnings': warnings,
         'next': {'action': 'fix', 'hint': '改 casting.json 里出错的坑位后重新 check；连续三轮不过就停下来报告'} if errors else
         {'action': 'review', 'hint': '生成复核页，请人处理低置信度和待确认文案'}}, 1 if errors else 0)


def cmd_apply(a) -> None:
    cards, casting = load(a.cards), load(a.casting)
    photos = load(a.photos) if a.photos else {'photos': []}
    project = Path(a.project)
    inputs_path, assets_path = project / 'inputs.json', project / 'assets.json'
    inputs, assets = load(inputs_path), load(assets_path)
    items = {item['id']: item for item in assets['items']}
    profiles = {p['id']: p for p in photos['photos']}
    props = inputs['props']
    imported = []
    for name in cards['slots']:
        rows = expand(name, casting['slots'])
        if not rows:
            continue
        ids = []
        for key, index, entry in rows:
            pid = entry.get('photo')
            if entry['source'] != 'photo':
                gen = Path(entry['generated']['file'])
                digest = hashlib.sha256(gen.read_bytes()).hexdigest()
                pid = f'gen-{digest[:16]}'
                if pid not in items:
                    from PIL import Image  # Pillow is a VVV requirement
                    with Image.open(gen) as im:
                        w, h = im.size
                    target = project / 'public' / 'photos' / f'{pid}{gen.suffix.lower()}'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(gen, target)
                    items[pid] = {'id': pid, 'file': f'photos/{target.name}', 'width': w, 'height': h,
                                  'orientation': 'landscape' if w > h else 'portrait' if h > w else 'square',
                                  'source': {'kind': 'local-image', 'name': gen.name, 'sha256': digest},
                                  'processing': ['ai-generated', entry['source']], 'faces': [],
                                  'notes': (entry.get('generated') or {}).get('prompt', '')}
                    imported.append(pid)
            elif pid not in items:
                out({'status': 'failed', 'code': 'PHOTO_NOT_IN_PROJECT',
                     'message': f'{key}: {pid} 不在工程的 assets.json 里',
                     'next': {'action': 'fix', 'hint': '用同一个照片文件夹 vvv.py init 创建工程，照片 id 才会一致'}}, 1)
            prof = profiles.get(pid)
            if prof and prof.get('faces') and not items[pid].get('faces'):
                items[pid]['faces'] = prof['faces']  # lets VVV crop around faces
            ids.append(pid)
            copy_cfg = cards['slots'][name].get('copy')
            if copy_cfg and 'copy' in entry:
                field = copy_cfg['field']
                if field.endswith('[i]'):
                    lst = props.setdefault(field[:-3], [])
                    while len(lst) <= (index or 0):
                        lst.append('')
                    lst[index or 0] = entry['copy']
                elif field.startswith('copy.'):
                    props.setdefault('copy', {})[field[5:]] = entry['copy']
        props['photos'][name] = ids if rows[0][1] is not None else ids[0]
    assets['items'] = list(items.values())
    assets_path.write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding='utf-8')
    inputs_path.write_text(json.dumps(inputs, ensure_ascii=False, indent=2), encoding='utf-8')
    out({'status': 'applied', 'project': str(project), 'importedGenerated': imported,
         'next': {'action': 'run', 'command': ['python3', '<vvv-skill>/scripts/vvv.py', 'validate', '--project', str(project)]}})


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('candidates')
    c.add_argument('--cards', required=True, type=Path)
    c.add_argument('--photos', required=True, type=Path)
    c.add_argument('--brief', type=Path)
    c.add_argument('--top', type=int, default=8)
    c.add_argument('--out', required=True, type=Path)
    k = sub.add_parser('check')
    k.add_argument('--cards', required=True, type=Path)
    k.add_argument('--photos', required=True, type=Path)
    k.add_argument('--casting', required=True, type=Path)
    k.add_argument('--brief', type=Path)
    k.add_argument('--catalog', type=Path)
    p = sub.add_parser('apply')
    p.add_argument('--cards', required=True, type=Path)
    p.add_argument('--casting', required=True, type=Path)
    p.add_argument('--project', required=True, type=Path)
    p.add_argument('--photos', type=Path)
    a = ap.parse_args()
    {'candidates': cmd_candidates, 'check': cmd_check, 'apply': cmd_apply}[a.cmd](a)


if __name__ == '__main__':
    main()
