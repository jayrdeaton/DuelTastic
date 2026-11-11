#!/usr/bin/env python3
"""Android's adaptive icon layers, from the splash art (assets/images/splash-dark.png, the icon's trails and heads on a
transparent background). No packages: ffmpeg reads and writes the PNGs as raw RGBA.

  python3 store/creative/android-icons.py

Writes, 1024 px each, over app.json's adaptiveIcon backgroundColor (#050505, the dark icon's):
- assets/images/android-icon-foreground.png: the art scaled so its farthest opaque pixel from the center of its smallest
  enclosing circle sits at 30% of the side, just inside Android's safe zone (a 66dp circle on the 108dp layer), and
  centered on that circle (Lumber's rule).
- assets/images/android-icon-monochrome.png: the same shape in white for themed icons, its alpha from each pixel's
  brightness (so the heads' black lines drop out and keep the rings apart from the trails), and the dots inside the
  heads at 45%, so a themed icon still shows two heads.

Rerun when the icon art changes.
"""

import math
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MASTER = os.path.join(ROOT, 'assets/images/splash-dark.png')
FOREGROUND = os.path.join(ROOT, 'assets/images/android-icon-foreground.png')
MONOCHROME = os.path.join(ROOT, 'assets/images/android-icon-monochrome.png')
SIDE = 1024
SAFE_RADIUS = 0.30 * SIDE
DOT_ALPHA = 0.45


def read_rgba(path, size=SIDE):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={size}:{size}', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], check=True, capture_output=True).stdout
    assert len(raw) == size * size * 4, path
    return raw


def write_rgba(raw, path, size=SIDE):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{size}x{size}', '-i', '-', '-pix_fmt', 'rgba', path], input=bytes(raw), check=True)


def circle_from(points):
    if not points:
        return (0.0, 0.0, -1.0)
    if len(points) == 1:
        return (points[0][0], points[0][1], 0.0)
    if len(points) == 2:
        (ax, ay), (bx, by) = points
        return ((ax + bx) / 2, (ay + by) / 2, math.dist((ax, ay), (bx, by)) / 2)
    (ax, ay), (bx, by), (cx, cy) = points
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        pairs = [circle_from([points[i], points[j]]) for i, j in ((0, 1), (0, 2), (1, 2))]
        return max(pairs, key=lambda c: c[2])
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return (ux, uy, math.dist((ux, uy), (ax, ay)))


def inside(c, p):
    return math.dist((c[0], c[1]), p) <= c[2] + 1e-6


def enclosing_circle(points):
    """Welzl's smallest enclosing circle, iteratively (expected linear time on shuffled points)"""
    pts = points[:]
    random.Random(1).shuffle(pts)
    c = (0.0, 0.0, -1.0)
    for i, p in enumerate(pts):
        if c[2] >= 0 and inside(c, p):
            continue
        c = (p[0], p[1], 0.0)
        for j in range(i):
            q = pts[j]
            if inside(c, q):
                continue
            c = circle_from([p, q])
            for k in range(j):
                r = pts[k]
                if not inside(c, r):
                    c = circle_from([p, q, r])
    return c


def main():
    master = read_rgba(MASTER)
    # Each row's leftmost and rightmost opaque pixel (both corners of it) bound every opaque pixel
    edges = []
    for y in range(SIDE):
        row = [x for x in range(SIDE) if master[(y * SIDE + x) * 4 + 3] > 8]
        if row:
            for x in (row[0], row[-1] + 1):
                edges += [(x, y), (x, y + 1)]
    cx, cy, radius = enclosing_circle(edges)
    scale = SAFE_RADIUS / radius
    size = round(SIDE * scale)
    left, top = round(SIDE / 2 - cx * scale), round(SIDE / 2 - cy * scale)
    print(f'art circle ({cx:.1f}, {cy:.1f}) r {radius:.1f}; scaled {scale:.3f} to {size}px at ({left}, {top})')
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-i', MASTER,
        '-filter_complex', f'color=c=black@0.0:s={SIDE}x{SIDE},format=rgba[base];[0:v]scale={size}:{size}:flags=lanczos,format=rgba[art];[base][art]overlay={left}:{top}:format=auto,format=rgba',
        '-frames:v', '1', '-pix_fmt', 'rgba', FOREGROUND
    ], check=True)

    fg = read_rgba(FOREGROUND)
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
