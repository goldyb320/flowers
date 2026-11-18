#!/usr/bin/env python3
"""
ASCII wildflowers - a rotating 3D bouquet in your terminal.

A new bouquet grows every day: the date seeds the random generator, so the
flower species, colors and arrangement change at midnight, but stay the same
all day (and match the web page / iPhone widget versions).

    python3 bouquet.py                    # today's bouquet, spinning
    python3 bouquet.py --date 2026-12-25  # preview another day
    python3 bouquet.py --frame            # print one still frame and exit

Needs a terminal with truecolor support (iTerm2, Windows Terminal, most Linux
terminals, VS Code). Ctrl-C to quit.
"""
import argparse
import datetime as dt
import math
import os
import shutil
import sys
import time

# ---------------------------------------------------------------- personalize
NOTES = [
    "picked fresh for you",
    "wildflowers, always in season",
    "a new bouquet every day",
    "thinking of you",
]
SPIN_SECONDS = 14          # time for one full rotation
FPS = 20
BG = (22, 26, 48)          # background color (deep navy, like the video)

TAU = math.pi * 2


# ------------------------------------------------- seeded RNG (matches the JS)
class Rng:
    """mulberry32 - tiny PRNG, bit-identical to the JavaScript version."""

    def __init__(self, seed):
        self.a = seed & 0xFFFFFFFF

    def __call__(self):
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = ((t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    def pick(self, seq):
        return seq[int(self() * len(seq))]

    def range(self, lo, hi):
        return lo + (hi - lo) * self()


def date_seed(d):
    return d.year * 10000 + d.month * 100 + d.day


# ------------------------------------------------------------ vector helpers
def norm(v):
    m = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) or 1.0
    return (v[0] / m, v[1] / m, v[2] / m)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def basis(u):
    h = (0.0, 1.0, 0.0) if abs(u[1]) < 0.9 else (1.0, 0.0, 0.0)
    a = norm(cross(u, h))
    b = cross(u, a)
    return a, b


def at(P, u, a, b, x, y, z):
    """Point in a flower's local frame: x,y across the face, z along the stem."""
    return (P[0] + a[0] * x + b[0] * y + u[0] * z,
            P[1] + a[1] * x + b[1] * y + u[1] * z,
            P[2] + a[2] * x + b[2] * y + u[2] * z)


# ------------------------------------------------------------ flower species
# each builder: (rng, P=head position, u=stem direction, color, add) -> None
# add(pos, char, rgb) appends a point

def petals(rng, P, u, add, n, r0, r1, width, cup, ch, col, center_ch, center_col, center_r):
    a, b = basis(u)
    rot = rng() * TAU
    for k in range(n):
        ang = rot + k * TAU / n
        r = r0
        while r <= r1:
            w = width * math.sin(math.pi * (r - r0) / (r1 - r0 + 1e-6) * 0.9 + 0.15)
            steps = max(1, int(w * r / 0.32))
            for j in range(-steps, steps + 1):
                aa = ang + (j / max(steps, 1)) * w
                add(at(P, u, a, b, r * math.cos(aa), r * math.sin(aa), cup * r * r), ch, col)
            r += 0.3
    # center disk
    rr = 0.0
    while rr <= center_r:
        m = max(1, int(TAU * rr / 0.3))
        for k in range(m):
            aa = k * TAU / m
            add(at(P, u, a, b, rr * math.cos(aa), rr * math.sin(aa), 0.15), center_ch, center_col)
        rr += 0.3


def daisy(rng, P, u, col, add):
    petals(rng, P, u, add, 13, 0.8, 2.3, 0.12, 0.05, "o", col, "@", (255, 205, 50), 0.6)


def cosmos(rng, P, u, col, add):
    petals(rng, P, u, add, 8, 0.6, 2.4, 0.32, 0.08, "O", col, "*", (255, 215, 60), 0.5)


def susan(rng, P, u, col, add):
    petals(rng, P, u, add, 12, 0.8, 2.2, 0.16, -0.04, "=", col, "@", (120, 65, 25), 0.7)


def poppy(rng, P, u, col, add):
    a, b = basis(u)
    r = 0.0
    while r <= 2.1:
        m = max(1, int(TAU * r / 0.3))
        for k in range(m):
            aa = k * TAU / m
            wob = 1 + 0.12 * math.sin(aa * 4)
            add(at(P, u, a, b, r * wob * math.cos(aa), r * wob * math.sin(aa), 0.18 * r * r),
                "x" if r < 0.5 else "O", (70, 30, 60) if r < 0.5 else col)
        r += 0.3


def spike(rng, P, u, col, add, length, radius, ch):
    a, b = basis(u)
    z = 0.0
    while z <= length:
        rad = radius * (1 - z / length) + 0.15
        m = max(3, int(TAU * rad / 0.35))
        off = rng() * TAU
        for k in range(m):
            aa = off + k * TAU / m
            add(at(P, u, a, b, rad * math.cos(aa), rad * math.sin(aa), z - 0.6), ch, col)
        z += 0.32


def lupine(rng, P, u, col, add):
    spike(rng, P, u, col, add, rng.range(4.0, 6.0), 1.1, "o")


def lavender(rng, P, u, col, add):
    spike(rng, P, u, col, add, rng.range(3.5, 5.0), 0.45, ":")


def ball(rng, P, u, col, add, radius, ch, count):
    a, b = basis(u)
    for _ in range(count):
        th = rng() * TAU
        cz = rng() * 2 - 1
        s = math.sqrt(1 - cz * cz)
        rr = radius * (0.7 + 0.3 * rng())
        add(at(P, u, a, b, rr * s * math.cos(th), rr * s * math.sin(th), rr * cz + radius * 0.4), ch, col)


def buttercup(rng, P, u, col, add):
    petals(rng, P, u, add, 5, 0.3, 1.0, 0.5, 0.25, "o", col, "*", (255, 245, 170), 0.2)


def cornflower(rng, P, u, col, add):
    ball(rng, P, u, col, add, 1.3, "*", 70)


def lace(rng, P, u, col, add):
    a, b = basis(u)
    for _ in range(9):  # little umbels on a dome
        th = rng() * TAU
        rr = rng() * 1.9
        cx, cy = rr * math.cos(th), rr * math.sin(th)
        cz = 0.5 - 0.15 * rr * rr
        for _ in range(9):
            t2 = rng() * TAU
            r2 = rng() * 0.45
            add(at(P, u, a, b, cx + r2 * math.cos(t2), cy + r2 * math.sin(t2), cz), rng.pick(".o"), col)


def breath(rng, P, u, col, add):
    a, b = basis(u)
    for _ in range(14):
        cx, cy, cz = rng.range(-2, 2), rng.range(-2, 2), rng.range(-1.5, 1.5)
        for _ in range(4):
            add(at(P, u, a, b, cx + rng.range(-.3, .3), cy + rng.range(-.3, .3), cz + rng.range(-.3, .3)),
                rng.pick(".o:"), col)


# name, builder, palettes, (min, max) stem length
SPECIES = [
    ("daisy", daisy, [(245, 245, 240), (255, 235, 245)], (14, 22)),
    ("cosmos", cosmos, [(255, 110, 170), (230, 80, 210), (255, 175, 205)], (15, 23)),
    ("poppy", poppy, [(245, 55, 45), (255, 135, 35), (255, 90, 120)], (12, 20)),
    ("lupine", lupine, [(150, 100, 255), (95, 115, 255), (240, 120, 210)], (16, 24)),
    ("lavender", lavender, [(175, 135, 240), (200, 160, 255)], (15, 22)),
    ("buttercup", buttercup, [(255, 220, 45), (255, 240, 120)], (10, 18)),
    ("cornflower", cornflower, [(70, 120, 255), (110, 90, 255)], (12, 20)),
    ("lace", lace, [(240, 240, 230), (255, 230, 240)], (14, 21)),
    ("susan", susan, [(255, 185, 25), (255, 150, 40)], (12, 20)),
    ("breath", breath, [(240, 240, 255), (200, 220, 255)], (13, 20)),
]


# ------------------------------------------------------------- the bouquet
class Bouquet:
    def __init__(self, day):
        self.day = day
        rng = Rng(date_seed(day))
        self.pts = []      # [x, y, z, char_or_None, (r,g,b), tx, ty, tz]
        add_pt = self.pts.append

        def add(p, ch, col):
            add_pt((p[0], p[1], p[2], ch, col, 0, 0, 0))

        # today's mix: 4-7 species, each with one palette
        idx = list(range(len(SPECIES)))
        for i in range(len(idx) - 1, 0, -1):  # Fisher-Yates
            j = int(rng() * (i + 1))
            idx[i], idx[j] = idx[j], idx[i]
        mix = [(SPECIES[i], rng.pick(SPECIES[i][2])) for i in idx[: 4 + int(rng() * 4)]]
        self.names = [m[0][0] for m in mix]

        n = 16 + int(rng() * 9)
        spin = rng() * TAU
        for i in range(n):
            (name, build, _, (lmin, lmax)), col = mix[int(rng() * len(mix))]
            theta = spin + i * 2.39996 + rng.range(-0.3, 0.3)  # golden angle
            phi = 0.1 + 0.68 * math.sqrt((i + 0.5) / n) + rng.range(-0.08, 0.08)
            L = rng.range(lmin, lmax) + 4
            ct, st = math.cos(theta), math.sin(theta)
            stem_col = (int(rng.range(70, 120)), int(rng.range(165, 215)), int(rng.range(80, 120)))

            def stem_at(s):
                ph = phi * (0.45 + 0.55 * s)
                return (L * s * math.sin(ph) * ct, L * s * math.cos(ph), L * s * math.sin(ph) * st)

            steps = int(L * 2.6)
            for k in range(steps + 1):
                s = k / steps
                p, q = stem_at(s), stem_at(min(1.0, s + 0.02) if s < 1 else s - 0.02)
                t = norm((q[0] - p[0], q[1] - p[1], q[2] - p[2])) if s < 1 else norm((p[0] - q[0], p[1] - q[1], p[2] - q[2]))
                add_pt((p[0], p[1], p[2], None, stem_col, t[0], t[1], t[2]))

            if rng() < 0.45:  # a leaf
                s = rng.range(0.3, 0.6)
                p = stem_at(s)
                lt = rng() * TAU
                for k in range(10):
                    d = k * 0.25
                    add((p[0] + d * math.cos(lt), p[1] + d * 0.5 - 0.05 * k * k * 0.25, p[2] + d * math.sin(lt)),
                        "~", (80, 175, 95))

            head = stem_at(1.0)
            u = norm((head[0] - stem_at(0.97)[0], head[1] - stem_at(0.97)[1], head[2] - stem_at(0.97)[2]))
            build(rng, head, u, col, add)

        # ribbon where the stems are tied
        rib = rng.pick([(255, 120, 170), (255, 90, 90), (250, 240, 245), (170, 130, 255)])
        for k in range(48):
            aa = k * TAU / 48
            add((1.0 * math.cos(aa), 3.0, 1.0 * math.sin(aa)), "=", rib)
        for side in (-1, 1):
            for k in range(26):
                aa = k * TAU / 26
                add((side * (1.0 + 1.1 * (1 - math.cos(aa))), 3.0 + 0.9 * math.sin(aa), 1.0), "%", rib)
            for k in range(10):
                add((side * (0.4 + k * 0.12), 2.6 - k * 0.3, 1.0), "%", rib)

        # recentre vertically
        ys = [p[1] for p in self.pts]
        self.cy = (max(ys) + min(ys)) / 2
        self.radius = max(math.sqrt(p[0] ** 2 + (p[1] - self.cy) ** 2 + p[2] ** 2) for p in self.pts)

        # twinkling background sparkles (screen-space, 0..1)
        self.stars = [(rng(), rng(), rng() * TAU, rng.range(1.5, 4.0),
                       rng.pick([(255, 255, 255), (255, 240, 170), (140, 255, 200), (255, 150, 200)]))
                      for _ in range(45)]
        self.note = NOTES[(date_seed(day) * 7) % len(NOTES)]


# ---------------------------------------------------------------- rendering
def render(bq, W, H, angle, t):
    """Return a W x H grid of (char, rgb) cells."""
    grid = [[(" ", None)] * W for _ in range(H)]
    zbuf = [[-1e9] * W for _ in range(H)]

    for sx, sy, ph, sp, col in bq.stars:
        x, y = int(sx * W), int(sy * (H - 2))
        v = math.sin(t * sp + ph)
        if v > 0.2:
            ch = "*" if v > 0.92 else "+" if v > 0.75 else "." if v > 0.45 else "·"
            grid[y][x] = (ch, tuple(int(c * (0.4 + 0.6 * v)) for c in col))

    note = bq.note
    date = f"{bq.day.strftime('%a %b').lower()} {bq.day.day}"
    caps = [f"{note}  ·  {date}"] if len(note) + len(date) + 5 <= W else [note, date]
    rows = H - 1 - len(caps)  # leave room for the caption
    D, TILT = bq.radius * 3.2, 0.28  # camera distance, look slightly down
    ct, st = math.cos(TILT), math.sin(TILT)
    if not hasattr(bq, "bounds"):  # measure the bouquet over a full turn, once
        xm, y0, y1 = 0.0, 1e9, -1e9
        for k in range(16):
            ca, sa = math.cos(k * TAU / 16), math.sin(k * TAU / 16)
            for x, y, z, *_ in bq.pts[::3]:
                y -= bq.cy
                x1, z1 = x * ca + z * sa, -x * sa + z * ca
                y2, z2 = y * ct - z1 * st, y * st + z1 * ct
                f = D / (D - z2)
                xm, y0, y1 = max(xm, abs(x1 * f)), min(y0, y2 * f), max(y1, y2 * f)
        bq.bounds = (xm, y0, y1)
    xm, y0, y1 = bq.bounds
    scale = min(rows * 0.96 / (y1 - y0), W * 0.48 / (xm * 2.0))
    cx, cy = W / 2, rows / 2 + (y1 + y0) / 2 * scale
    ca, sa = math.cos(angle), math.sin(angle)
    R = bq.radius

    for x, y, z, ch, col, tx, ty, tz in bq.pts:
        y -= bq.cy
        x1 = x * ca + z * sa
        z1 = -x * sa + z * ca
        y2 = y * ct - z1 * st
        z2 = y * st + z1 * ct
        f = scale * D / (D - z2)
        px = int(cx + x1 * f * 2.0)
        py = int(cy - y2 * f)
        if 0 <= px < W and 0 <= py < rows and z2 > zbuf[py][px]:
            zbuf[py][px] = z2
            if ch is None:  # stem: pick a slash that follows its on-screen slope
                vx = (tx * ca + tz * sa) * 2.0
                vy = -(ty * ct - (-tx * sa + tz * ca) * st)
                if abs(vx) < 0.45 * abs(vy):
                    ch = "|"
                elif abs(vy) < 0.45 * abs(vx):
                    ch = "-"
                else:
                    ch = "/" if vx * vy < 0 else "\\"
            light = 0.45 + 0.55 * max(0.0, min(1.0, (z2 + R) / (2 * R)))
            grid[py][px] = (ch, (int(col[0] * light), int(col[1] * light), int(col[2] * light)))

    for k, cap in enumerate(caps):
        start = max(0, (W - len(cap)) // 2)
        for i, c in enumerate(cap[:W]):
            grid[H - len(caps) + k][start + i] = (c, (230, 120, 170))
    return grid


def to_ansi(grid):
    bg = "\x1b[48;2;%d;%d;%dm" % BG
    out = ["\x1b[H", bg]
    last = None
    for row in grid:
        for ch, col in row:
            if col is not None and col != last:
                out.append("\x1b[38;2;%d;%d;%dm" % col)
                last = col
            out.append(ch)
        out.append("\n")
    out.pop()
    return "".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", help="YYYY-MM-DD (default: today)")
    ap.add_argument("--frame", action="store_true", help="print one frame and exit")
    args = ap.parse_args()
    day = dt.date.fromisoformat(args.date) if args.date else dt.date.today()

    bq = Bouquet(day)
    if args.frame:
        W, H = shutil.get_terminal_size((100, 45))
        print(to_ansi(render(bq, W, H - 1, 0.6, 1.0)) + "\x1b[0m")
        return

    sys.stdout.write("\x1b[?25l\x1b[2J")  # hide cursor, clear
    t0 = time.time()
    try:
        while True:
            if dt.date.today() != bq.day and not args.date:  # midnight: new flowers
                bq = Bouquet(dt.date.today())
            W, H = shutil.get_terminal_size((100, 45))
            t = time.time() - t0
            sys.stdout.write(to_ansi(render(bq, W, H, t * TAU / SPIN_SECONDS, t)))
            sys.stdout.flush()
            time.sleep(max(0, 1 / FPS - (time.time() - t0 - t)))
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\x1b[0m\x1b[?25h\x1b[2J\x1b[H")


if __name__ == "__main__":
    main()
