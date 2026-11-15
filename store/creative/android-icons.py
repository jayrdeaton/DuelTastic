#!/usr/bin/env python3
"""Android's adaptive icon layers, from the iOS icon (assets/images/icon-dark.png: the two trails running in from the
left edge, folding back twice and meeting head on, on #050505). No packages: ffmpeg reads and writes the PNGs as raw
RGBA.

  python3 store/creative/android-icons.py

Writes, 1024 px each, over app.json's adaptiveIcon backgroundColor (#050505, the dark icon's):
- assets/images/android-icon-foreground.png: the iOS icon's art on a transparent layer, framed as on iOS (the icon's
  center on the layer's), and scaled so the farthest pixel of the folds and heads sits at 30% of the side, just inside
  Android's safe zone (a 66dp circle on the 108dp layer), so no launcher's mask cuts them. The trails run off the edge
  as they do on iOS (Jay, 2026-11-15): every row of art that touches the icon's edge carries on out to the layer's
  edge, under whatever mask the launcher draws. It was the splash art until then, whose trails stop short with rounded
  tails.
- assets/images/android-icon-monochrome.png: the same shape in white for themed icons, its alpha from each pixel's
  brightness (so the heads' black lines drop out and keep the rings apart from the trails), and the dots inside the
  heads at 45%, so a themed icon still shows two heads.

The icon's background drops out (no channel brighter than BACKGROUND_MAX), and with it the heads' black lines, which
can't be seen on the dark icon either. Rerun when the icon art changes.
"""

import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MASTER = os.path.join(ROOT, 'assets/images/icon-dark.png')
FOREGROUND = os.path.join(ROOT, 'assets/images/android-icon-foreground.png')
MONOCHROME = os.path.join(ROOT, 'assets/images/android-icon-monochrome.png')
SIDE = 1024
SAFE_RADIUS = 0.30 * SIDE
BACKGROUND_MAX = 12
DOT_ALPHA = 0.45


def read_rgba(path, size=SIDE):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={size}:{size}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], check=True, capture_output=True).stdout
    assert len(raw) == size * size * 4, path
    return raw


def write_rgba(raw, path, size=SIDE):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{size}x{size}', '-i', '-', '-pix_fmt', 'rgba', path], input=bytes(raw), check=True)


def is_art(raw, size, x, y):
    return max(raw[(y * size + x) * 4:(y * size + x) * 4 + 3]) > BACKGROUND_MAX


def main():
    master = read_rgba(MASTER)
    # The trails: the rows of art that touch the icon's left or right edge. Everything between where they come in (the
    # folds and heads) has to clear the safe zone
    if any(is_art(master, SIDE, x, 0) or is_art(master, SIDE, x, SIDE - 1) for x in range(SIDE)):
        sys.exit('art runs off the top or bottom edge, which this only measures for the left and right')
    left_rows = {y for y in range(SIDE) if is_art(master, SIDE, 0, y)}
    right_rows = {y for y in range(SIDE) if is_art(master, SIDE, SIDE - 1, y)}
    if not left_rows and not right_rows:
        sys.exit('nothing runs off the icon edge')
    off_trail = [x for y in range(SIDE) if y not in left_rows | right_rows for x in range(SIDE) if is_art(master, SIDE, x, y)]
    inner_left, inner_right = min(off_trail), max(off_trail)

    def run_in(x, y):
        return (y in left_rows and x < inner_left) or (y in right_rows and x > inner_right)

    far = max(math.dist((x + 0.5, y + 0.5), (SIDE / 2, SIDE / 2)) for y in range(SIDE) for x in range(SIDE) if is_art(master, SIDE, x, y) and not run_in(x, y))
    size = round(SIDE * SAFE_RADIUS / far)
    size += size % 2
    offset = (SIDE - size) // 2
    print(f'folds and heads reach {far:.1f}px from the center (x {inner_left} to {inner_right}); icon scaled to {size}px at {offset}')

    art = read_rgba(MASTER, size)
    fg = bytearray(SIDE * SIDE * 4)
    for y in range(SIDE):
        for x in range(SIDE):
            # Past the icon's edge, its edge pixel carries on, so only a trail running off it continues
            sx, sy = min(max(x - offset, 0), size - 1), min(max(y - offset, 0), size - 1)
            if is_art(art, size, sx, sy):
                i = (sy * size + sx) * 4
                fg[(y * SIDE + x) * 4:(y * SIDE + x) * 4 + 4] = art[i:i + 4]
    write_rgba(fg, FOREGROUND)

    # The heads' white rings: bright, unsaturated, opaque. Split the two (stacked one above the other) at their middle
    ring = []
    for i in range(SIDE * SIDE):
        r, g, b, a = fg[i * 4:i * 4 + 4]
        if a > 200 and min(r, g, b) > 200:
            ring.append((i % SIDE, i // SIDE))
    if not ring:
        sys.exit('no head rings found')
    mid = sorted(p[1] for p in ring)[len(ring) // 2]
    heads = []
    for group in ([p for p in ring if p[1] < mid], [p for p in ring if p[1] >= mid]):
        hx, hy = sum(p[0] for p in group) / len(group), sum(p[1] for p in group) / len(group)
        heads.append((hx, hy, min(math.dist((hx, hy), p) for p in group)))
    print('heads', [(round(x), round(y), round(r)) for x, y, r in heads])

    mono = bytearray(SIDE * SIDE * 4)
    for i in range(SIDE * SIDE):
        r, g, b, a = fg[i * 4:i * 4 + 4]
        if not a:
            continue
        alpha = a / 255 * max(r, g, b) / 255
        x, y = i % SIDE + 0.5, i // SIDE + 0.5
        if max(r, g, b) - min(r, g, b) > 60 and any(math.dist((x, y), (hx, hy)) < hr for hx, hy, hr in heads):
            alpha *= DOT_ALPHA
        mono[i * 4:i * 4 + 4] = (255, 255, 255, round(alpha * 255))
    write_rgba(mono, MONOCHROME)
    print('wrote', os.path.relpath(FOREGROUND, ROOT), os.path.relpath(MONOCHROME, ROOT))


if __name__ == '__main__':
    main()
