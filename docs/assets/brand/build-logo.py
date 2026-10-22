"""Build the stacked triple-V logo files from one set of coordinates.

Run `python3 docs/assets/brand/build-logo.py` to rewrite the SVGs and the PNG renders beside this script.
The SVGs are the editable source; the PNGs are 4x-supersampled renders of the same polygons (needs Pillow).
"""
from pathlib import Path

W, H, A, S, GAP = 500, 406, 148, 352, 11  # V width/height, arm width at the top, step between Vs, knock-out gap
INK, PAPER, SIGNAL = '#111111', '#F5F3E8', '#DFFF00'

def v(x):
    """One V: flat top, parallel inner/outer arm edges, sharp apex."""
    notch = (W / 2 - A) * H / (W / 2)
    return [(x, 0), (x + A, 0), (x + W / 2, notch), (x + W - A, 0), (x + W, 0), (x + W / 2, H)]

def clip_right_of(poly, p, q, offset):
    """Keep the part of poly right of line p->q moved `offset` to the right (Sutherland-Hodgman)."""
    (x1, y1), (x2, y2) = p, q
    dx, dy = x2 - x1, y2 - y1
    n = (dx * dx + dy * dy) ** 0.5
    side = lambda pt: ((pt[0] - x1) * dy - (pt[1] - y1) * dx) / n - offset  # >0: right of the line (y down)
    out = []
    for i, cur in enumerate(poly):
        prev = poly[i - 1]
        sc, sp = side(cur), side(prev)
        if (sc >= 0) != (sp >= 0):
            t = sp / (sp - sc)
            out.append((prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])))
        if sc >= 0:
            out.append(cur)
    return out

def shapes():
    """Front to back: the left V is in front; each later V tucks behind the previous one's right arm."""
    result = []
    for k in range(3):
        poly = v(k * S)
        if k:
            px = (k - 1) * S
            # Keep what lies beyond the previous V's right outer edge (top-right corner -> apex), plus the gap.
            poly = clip_right_of(poly, (px + W, 0), (px + W / 2, H), GAP)
        result.append(poly)
    return result

def path(poly):
    pts = [f'{round(x, 1):g} {round(y, 1):g}' for x, y in poly]
    return 'M' + 'L'.join(pts) + 'Z'

WIDTH = 2 * S + W

def svg(colors, title='Vibe Vision Video', desc='', background=None, size=None, inset=0):
    paths = '\n'.join(f'    <path fill="{c}" d="{path(p)}"/>' for p, c in zip(shapes(), colors))
    if size is None:
        head = f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{H}" viewBox="0 0 {WIDTH} {H}" role="img" aria-labelledby="title desc">'
        body = f'  <g>\n{paths}\n  </g>'
    else:
        scale = (size - 2 * inset) / WIDTH
        ty = (size - H * scale) / 2
        head = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}" role="img" aria-labelledby="title desc">'
        body = (f'  <rect width="{size}" height="{size}" fill="{background}"/>\n'
                f'  <g transform="translate({inset:g} {round(ty, 3):g}) scale({round(scale, 6):g})">\n{paths}\n  </g>')
    return f'{head}\n  <title id="title">{title}</title>\n  <desc id="desc">{desc}</desc>\n{body}\n</svg>\n'

def raster(path_out, colors, width, height, mark_width, background=None, supersample=4):
    """Render the same polygons as the SVG: the mark `mark_width` px wide, centered."""
    from PIL import Image, ImageDraw
    k = supersample
    image = Image.new('RGBA', (width * k, height * k), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = mark_width * k / WIDTH
    ox, oy = (width * k - WIDTH * scale) / 2, (height * k - H * scale) / 2
    for poly, color in reversed(list(zip(shapes(), colors))):
        draw.polygon([(ox + x * scale, oy + y * scale) for x, y in poly], fill=color)
    image.resize((width, height), Image.LANCZOS).save(path_out)


if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    d = ('Three identical V forms laid down in sequence, each tucked behind the previous one with a narrow gap; '
         'the last V is signal yellow. One template, reused.')
    files = {
        'logo.svg': svg([INK, INK, SIGNAL], desc=d + ' For light backgrounds.'),
        'logo-light.svg': svg([PAPER, PAPER, SIGNAL], desc=d + ' For dark backgrounds.'),
        'logo-mono.svg': svg([INK, INK, INK], desc=d.replace('; the last V is signal yellow', '') + ' One-color version.'),
        'avatar.svg': svg([PAPER, PAPER, SIGNAL], title='Vibe Vision Video avatar', desc='The stacked triple-V logo centered on an ink square.',
                          background=INK, size=512, inset=52),
    }
    for name, text in files.items():
        (here / name).write_text(text)
    raster(here / 'logo.png', [INK, INK, SIGNAL], 1774, 887, 1206)
    raster(here / 'logo-light.png', [PAPER, PAPER, SIGNAL], 1774, 887, 1206)
    raster(here / 'avatar.png', [PAPER, PAPER, SIGNAL], 512, 512, 512 - 2 * 52, background=INK)
