#!/usr/bin/env python3
"""Beat calibration: measure where a template's picture changes most, in design seconds.

Renders the composition silent (no beat map, so frame time is design time), finds the frames
where the picture changes most relative to their surroundings, and writes them as hits.json.
The template turns these into warp anchors, so its biggest visual moments land on the beat of
whatever song the project uses. Re-run it after changing a template's motion.

    python3 scripts/calibrate.py --entry examples/cases.tsx --composition VVV-Doodle \
        --props examples/doodle-wedding.json --out src/templates/doodle/hits.json
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image

SIZE = (48, 27)


def changes(video, folder):
    pattern = str(Path(folder) / '%06d.png')
    subprocess.run(['npx', 'remotion', 'ffmpeg', '-v', 'error', '-nostdin', '-i', str(video), '-an',
                    '-s', f'{SIZE[0]}x{SIZE[1]}', '-f', 'image2', pattern], check=True)
    frames = [Image.open(p).convert('L').tobytes() for p in sorted(Path(folder).glob('*.png'))]
    n = len(frames[0])
    return [sum(abs(a - b) for a, b in zip(frames[i], frames[i - 1])) / n for i in range(1, len(frames))]


def peaks(diff, fps, gap=0.3, edge=0.5):
    """Local maxima of the smoothed change curve that stand out from their surroundings."""
    smooth = [sum(diff[max(0, i - 1):i + 2]) / len(diff[max(0, i - 1):i + 2]) for i in range(len(diff))]
    top = max(smooth)
    found = []
    for i in range(3, len(smooth) - 3):
        if smooth[i] < max(smooth[i - 3:i + 4]):
            continue
        base = min(smooth[max(0, i - 30):i + 30])
        if smooth[i] >= 2.5 and smooth[i] >= base * 1.8 and smooth[i] >= 0.12 * top:
            t = (i + 1) / fps
            if found and t - found[-1]['t'] < gap:
                if smooth[i] > found[-1]['s']:
                    found[-1] = {'t': t, 's': smooth[i]}
            else:
                found.append({'t': t, 's': smooth[i]})
    end = len(diff) / fps
    return [p for p in found if edge < p['t'] < end - edge]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--entry', default='src/index.tsx')
    parser.add_argument('--composition', required=True)
    parser.add_argument('--props', type=Path, help='Inputs JSON ({"props": …} or bare props); music is removed for the render.')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--fps', type=int, default=30)
    args = parser.parse_args()
    props = {}
    if args.props:
        data = json.loads(args.props.read_text(encoding='utf-8'))
        props = data.get('props', data)
    # No music → no beat map → identity warp: rendered seconds are design seconds.
    props = {**props, 'fps': args.fps, 'music': {**props.get('music', {}), 'src': ''}}
    if isinstance(props.get('music2'), dict):
        props['music2'] = {**props['music2'], 'src': ''}
    with tempfile.TemporaryDirectory(prefix='vvv-calibrate-') as folder:
        video = Path(folder) / 'calibrate.mp4'
        props_file = Path(folder) / 'props.json'
        props_file.write_text(json.dumps(props), encoding='utf-8')
        subprocess.run(['npx', 'remotion', 'render', args.entry, args.composition, str(video), '--scale=0.5',
                        f'--props={props_file}', '--log=error'], check=True)
        frames = Path(folder) / 'frames'
        frames.mkdir()
        found = peaks(changes(video, frames), args.fps)
    ranked = sorted(p['s'] for p in found)
    # The strongest third are scene-scale changes ("cut"); the rest are entrances and accents ("beat").
    strong = ranked[int(len(ranked) * 0.65)] if ranked else float('inf')
    hits = [{'t': round(p['t'], 3), 's': round(p['s'], 1), 'kind': 'cut' if p['s'] >= strong else 'beat'} for p in found]
    args.out.write_text(json.dumps(hits, indent=1) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'passed', 'hits': len(hits), 'cuts': sum(h['kind'] == 'cut' for h in hits), 'out': str(args.out)}))


if __name__ == '__main__':
    main()
