#!/usr/bin/env python3
"""Photo intake and technical profile for a studio order.

    python studio_profile.py --photos DIR --out photos.json --sheets DIR [--birthday YYYY-MM-DD] [--event first-birthday]

Reads every image under DIR (zip archives are extracted next to themselves first), fixes EXIF rotation, and
writes one record per photo: the same id VVV gives the photo (photo-<sha256[:16]>), size, orientation,
capture time, age of the baby at capture (with --birthday), sharpness, brightness, a perceptual hash with
near-duplicate groups, and quality flags. It also writes numbered contact sheets so an agent can look at the
photos 16 at a time and fill in the content fields that are left empty here: people, shot, scenes, moods,
caption, faces.

Stdlib + Pillow only. HEIC needs pillow-heif (pip install pillow-heif).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat

try:  # optional HEIC support
    from pillow_heif import register_heif_opener  # type: ignore
    register_heif_opener()
    HEIC = True
except Exception:  # pragma: no cover - depends on the machine
    HEIC = False

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.heic', '.heif'}
SKIP_DIRS = {'__MACOSX', '.git', 'node_modules'}
DUP_BITS = 6          # dHash Hamming distance at or below which two photos count as near-duplicates
BLUR_FLOOR = 6.0      # edge-strength below which a photo is flagged blurry (calibrated on phone photos)
LOW_RES_SHORT = 480   # short side below which a photo is flagged low-res
SHEET_COLS, SHEET_ROWS, CELL = 4, 4, 400


def fail(code: str, message: str, hint: str = '') -> None:
    print(json.dumps({'status': 'failed', 'code': code, 'message': message, 'next': {'action': 'fix', 'hint': hint}},
                     ensure_ascii=False))
    sys.exit(1)


def extract_archives(root: Path) -> list[str]:
    """Extract every .zip under root into a sibling folder (once); return what was extracted."""
    done = []
    for archive in sorted(root.rglob('*.zip')):
        target = archive.with_suffix('')
        if target.exists():
            continue
        with zipfile.ZipFile(archive) as zf:
            for member in zf.infolist():
                name = member.filename
                # Chinese archives made on Windows often store names in GBK without the UTF-8 flag.
                if not member.flag_bits & 0x800:
                    try:
                        name = name.encode('cp437').decode('gbk')
                    except (UnicodeEncodeError, UnicodeDecodeError):
                        pass
                dest = (target / name).resolve()
                if target.resolve() not in dest.parents and dest != target.resolve():
                    continue  # unsafe path
                if member.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as src, open(dest, 'wb') as out:
                    out.write(src.read())
        done.append(str(archive))
    return done


def capture_time(image: Image.Image) -> str | None:
    exif = image.getexif()
    raw = None
    try:
        sub = exif.get_ifd(0x8769)  # Exif IFD
        raw = sub.get(36867) or sub.get(36868)  # DateTimeOriginal, DateTimeDigitized
    except Exception:
        pass
    raw = raw or exif.get(306)  # DateTime
    if not raw:
        return None
    try:
        return dt.datetime.strptime(str(raw).strip()[:19], '%Y:%m:%d %H:%M:%S').isoformat()
    except ValueError:
        return None


def dhash(gray: Image.Image) -> int:
    small = gray.resize((9, 8), Image.LANCZOS)
    px = small.tobytes()
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits


def sharpness(gray: Image.Image) -> float:
    """Mean edge strength on a 512px copy: low values mean a blurry or flat photo."""
    small = gray.copy()
    small.thumbnail((512, 512))
    edges = small.filter(ImageFilter.FIND_EDGES)
    return round(ImageStat.Stat(edges).mean[0], 2)


def baby_phase(event: str, days: int | None) -> str | None:
    if days is None:
        return None
    if days < 0:
        return 'pregnancy'
    if event == 'full-month':
        return 'birth' if days == 0 else 'd1-7' if days <= 7 else 'd8-30' if days <= 30 else 'full-month'
    if event == 'hundred-days':
        return 'birth' if days == 0 else 'd1-30' if days <= 30 else 'd31-60' if days <= 60 else 'd61-99' if days <= 98 else 'day100'
    months = days / 30.44
    if days == 0:
        return 'birth'
    if months < 1:
        return 'm0'
    if months < 4:
        return 'm1-3'
    if months < 7:
        return 'm4-6'
    if months < 10:
        return 'm7-9'
    if months < 12:
        return 'm10-12'
    return 'birthday'


def font(size: int):
    for name in ('msyh.ttc', 'simhei.ttf', 'NotoSansCJK-Regular.ttc', 'DejaVuSans.ttf', 'Arial.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheets(records: list[dict], images: dict[str, Image.Image], folder: Path) -> list[str]:
    folder.mkdir(parents=True, exist_ok=True)
    per = SHEET_COLS * SHEET_ROWS
    label_font = font(22)
    out = []
    for start in range(0, len(records), per):
        batch = records[start:start + per]
        sheet = Image.new('RGB', (SHEET_COLS * CELL, SHEET_ROWS * (CELL + 36)), 'white')
        draw = ImageDraw.Draw(sheet)
        for i, rec in enumerate(batch):
            thumb = images[rec['id']].copy()
            thumb.thumbnail((CELL - 8, CELL - 8))
            x = (i % SHEET_COLS) * CELL
            y = (i // SHEET_COLS) * (CELL + 36)
            sheet.paste(thumb, (x + (CELL - thumb.width) // 2, y + (CELL - thumb.height) // 2))
            label = f"#{rec['index']}  {rec['takenAt'][:10] if rec['takenAt'] else '无时间'}"
            if rec['flags']:
                label += '  ⚠' + ','.join(rec['flags'])
            draw.text((x + 8, y + CELL + 4), label, fill='black', font=label_font)
        path = folder / f'sheet-{start // per + 1:02d}.jpg'
        sheet.save(path, quality=85)
        out.append(str(path))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--photos', required=True, type=Path)
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--sheets', required=True, type=Path)
    ap.add_argument('--event', choices=['wedding', 'first-birthday', 'full-month', 'hundred-days'], default='wedding')
    ap.add_argument('--birthday', help='baby birth date YYYY-MM-DD (first-birthday / full-month / hundred-days)')
    args = ap.parse_args()
    if not args.photos.is_dir():
        fail('PHOTOS_MISSING', f'{args.photos} is not a folder.', 'Pass the folder that holds the photos or the zip.')
    if args.out.exists():
        fail('OUTPUT_EXISTS', f'{args.out} already exists.', 'Choose a new path; the agent may have edited the old one.')
    birthday = dt.date.fromisoformat(args.birthday) if args.birthday else None

    extracted = extract_archives(args.photos)
    files = []
    for path in sorted(args.photos.rglob('*')):
        if any(part in SKIP_DIRS or part.startswith('.') for part in path.relative_to(args.photos).parts):
            continue
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
            files.append(path)

    records, images, skipped, seen = [], {}, [], {}
    for path in files:
        rel = str(path.relative_to(args.photos))
        if path.suffix.lower() in {'.heic', '.heif'} and not HEIC:
            skipped.append({'file': rel, 'reason': 'HEIC 需要 pillow-heif：pip install pillow-heif'})
            continue
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        pid = f'photo-{digest[:16]}'
        if pid in seen:
            skipped.append({'file': rel, 'reason': f'与 {seen[pid]} 内容完全相同'})
            continue
        try:
            with Image.open(path) as raw:
                taken = capture_time(raw)
                image = ImageOps.exif_transpose(raw).convert('RGB')
        except Exception as error:  # unreadable file
            skipped.append({'file': rel, 'reason': f'无法读取：{error}'})
            continue
        seen[pid] = rel
        gray = image.convert('L')
        w, h = image.size
        sharp = sharpness(gray)
        flags = []
        if sharp < BLUR_FLOOR:
            flags.append('blurry')
        if min(w, h) < LOW_RES_SHORT:
            flags.append('low-res')
        if w / h < 0.5 and h > 1800:
            flags.append('screenshot')  # very tall phone screenshots; the agent confirms
        days = None
        if birthday and taken:
            days = (dt.date.fromisoformat(taken[:10]) - birthday).days
        records.append({
            'id': pid, 'file': rel, 'sha256': digest, 'width': w, 'height': h,
            'orientation': 'landscape' if w > h else 'portrait' if h > w else 'square',
            'takenAt': taken, 'ageDays': days,
            'phase': baby_phase(args.event, days) if args.event != 'wedding' else None,
            'sharpness': sharp, 'brightness': round(ImageStat.Stat(gray).mean[0], 1),
            'dhash': f'{dhash(gray):016x}', 'dupGroup': None, 'flags': flags,
            # filled in by the agent after looking at the contact sheets
            'people': [], 'shot': None, 'scenes': [], 'moods': [], 'caption': '', 'faces': [],
        })
        image.thumbnail((CELL, CELL))
        images[pid] = image

    # chronological order (undated last, then by file name); index is what the contact sheets print
    records.sort(key=lambda r: (r['takenAt'] is None, r['takenAt'] or '', r['file']))
    for i, rec in enumerate(records, 1):
        rec['index'] = i
    # near-duplicate groups by dHash
    group = 0
    for i, a in enumerate(records):
        for b in records[i + 1:]:
            if bin(int(a['dhash'], 16) ^ int(b['dhash'], 16)).count('1') <= DUP_BITS:
                if a['dupGroup'] is None:
                    group += 1
                    a['dupGroup'] = group
                b['dupGroup'] = b['dupGroup'] or a['dupGroup']
    for rec in records:
        if rec['dupGroup'] is not None:
            rec['flags'].append('near-duplicate')

    sheets = contact_sheets(records, images, args.sheets)
    result = {
        'version': '1.0.0', 'event': args.event, 'birthday': args.birthday, 'source': str(args.photos),
        'extracted': extracted, 'photos': records, 'skipped': skipped, 'sheets': sheets,
        'todo': 'Look at each contact sheet and fill people, shot, scenes, moods, caption for every photo '
                '(ids from vocabulary.json). Faces may stay empty until a face detector is installed.',
    }
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    undated = sum(1 for r in records if not r['takenAt'])
    print(json.dumps({'status': 'profiled', 'photos': len(records), 'skipped': len(skipped), 'undated': undated,
                      'dupGroups': group, 'sheets': sheets, 'out': str(args.out)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
