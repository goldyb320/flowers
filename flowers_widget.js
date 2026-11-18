// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: seedling;
//
// ASCII wildflowers widget - a new bouquet every day.
// Setup: install "Scriptable" from the App Store, make a new script, paste
// this whole file in, set PAGE_URL below, then add a Scriptable widget to the
// home screen (long-press > Edit Widget > Script: this one).

// ---- ASCII wildflowers core: a line-for-line port of bouquet.py ----------
// Same seeded RNG and same order of random draws, so a given date grows the
// same bouquet in Python, on the web page and in the iPhone widget.

const NOTES = [
  "Picked fresh for you",
  "Wildflowers, always in season",
  "A new bouquet every day",
  "Thinking of you",
  "I miss you",
];
const BG = [22, 26, 48];
const TAU = Math.PI * 2;

class Rng {
  constructor(seed) { this.a = seed >>> 0; }
  next() {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (((t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick(seq) { return seq[Math.floor(this.next() * seq.length)]; }
  range(lo, hi) { return lo + (hi - lo) * this.next(); }
}

const dateSeed = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function basis(u) {
  const h = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const a = norm(cross(u, h));
  return [a, cross(u, a)];
}
const at = (P, u, a, b, x, y, z) => [
  P[0] + a[0] * x + b[0] * y + u[0] * z,
  P[1] + a[1] * x + b[1] * y + u[1] * z,
  P[2] + a[2] * x + b[2] * y + u[2] * z,
];

// ---- flower species --------------------------------------------------------
function petals(rng, P, u, add, n, r0, r1, width, cup, ch, col, cch, ccol, cr) {
  const [a, b] = basis(u);
  const rot = rng.next() * TAU;
  for (let k = 0; k < n; k++) {
    const ang = rot + k * TAU / n;
    for (let r = r0; r <= r1; r += 0.3) {
      const w = width * Math.sin(Math.PI * (r - r0) / (r1 - r0 + 1e-6) * 0.9 + 0.15);
      const steps = Math.max(1, Math.floor(w * r / 0.32));
      for (let j = -steps; j <= steps; j++) {
        const aa = ang + (j / Math.max(steps, 1)) * w;
        add(at(P, u, a, b, r * Math.cos(aa), r * Math.sin(aa), cup * r * r), ch, col);
      }
    }
  }
  for (let rr = 0; rr <= cr; rr += 0.3) {
    const m = Math.max(1, Math.floor(TAU * rr / 0.3));
    for (let k = 0; k < m; k++) {
      const aa = k * TAU / m;
      add(at(P, u, a, b, rr * Math.cos(aa), rr * Math.sin(aa), 0.15), cch, ccol);
    }
  }
}
const daisy = (rng, P, u, col, add) => petals(rng, P, u, add, 13, 0.8, 2.3, 0.12, 0.05, "o", col, "@", [255, 205, 50], 0.6);
const cosmos = (rng, P, u, col, add) => petals(rng, P, u, add, 8, 0.6, 2.4, 0.32, 0.08, "O", col, "*", [255, 215, 60], 0.5);
const susan = (rng, P, u, col, add) => petals(rng, P, u, add, 12, 0.8, 2.2, 0.16, -0.04, "=", col, "@", [120, 65, 25], 0.7);
const buttercup = (rng, P, u, col, add) => petals(rng, P, u, add, 5, 0.3, 1.0, 0.5, 0.25, "o", col, "*", [255, 245, 170], 0.2);

function poppy(rng, P, u, col, add) {
  const [a, b] = basis(u);
  for (let r = 0; r <= 2.1; r += 0.3) {
    const m = Math.max(1, Math.floor(TAU * r / 0.3));
    for (let k = 0; k < m; k++) {
      const aa = k * TAU / m, wob = 1 + 0.12 * Math.sin(aa * 4);
      add(at(P, u, a, b, r * wob * Math.cos(aa), r * wob * Math.sin(aa), 0.18 * r * r),
        r < 0.5 ? "x" : "O", r < 0.5 ? [70, 30, 60] : col);
    }
  }
}
function spike(rng, P, u, col, add, length, radius, ch) {
  const [a, b] = basis(u);
  for (let z = 0; z <= length; z += 0.32) {
    const rad = radius * (1 - z / length) + 0.15;
    const m = Math.max(3, Math.floor(TAU * rad / 0.35));
    const off = rng.next() * TAU;
    for (let k = 0; k < m; k++) {
      const aa = off + k * TAU / m;
      add(at(P, u, a, b, rad * Math.cos(aa), rad * Math.sin(aa), z - 0.6), ch, col);
    }
  }
}
const lupine = (rng, P, u, col, add) => spike(rng, P, u, col, add, rng.range(4.0, 6.0), 1.1, "o");
const lavender = (rng, P, u, col, add) => spike(rng, P, u, col, add, rng.range(3.5, 5.0), 0.45, ":");

function ball(rng, P, u, col, add, radius, ch, count) {
  const [a, b] = basis(u);
  for (let i = 0; i < count; i++) {
    const th = rng.next() * TAU, cz = rng.next() * 2 - 1, s = Math.sqrt(1 - cz * cz);
    const rr = radius * (0.7 + 0.3 * rng.next());
    add(at(P, u, a, b, rr * s * Math.cos(th), rr * s * Math.sin(th), rr * cz + radius * 0.4), ch, col);
  }
}
const cornflower = (rng, P, u, col, add) => ball(rng, P, u, col, add, 1.3, "*", 70);

function lace(rng, P, u, col, add) {
  const [a, b] = basis(u);
  for (let i = 0; i < 9; i++) {
    const th = rng.next() * TAU, rr = rng.next() * 1.9;
    const cx = rr * Math.cos(th), cy = rr * Math.sin(th), cz = 0.5 - 0.15 * rr * rr;
    for (let j = 0; j < 9; j++) {
      const t2 = rng.next() * TAU, r2 = rng.next() * 0.45;
      const p = at(P, u, a, b, cx + r2 * Math.cos(t2), cy + r2 * Math.sin(t2), cz);
      add(p, rng.pick(".o"), col);
    }
  }
}
function breath(rng, P, u, col, add) {
  const [a, b] = basis(u);
  for (let i = 0; i < 14; i++) {
    const cx = rng.range(-2, 2), cy = rng.range(-2, 2), cz = rng.range(-1.5, 1.5);
    for (let j = 0; j < 4; j++) {
      const x = cx + rng.range(-.3, .3), y = cy + rng.range(-.3, .3), z = cz + rng.range(-.3, .3);
      add(at(P, u, a, b, x, y, z), rng.pick(".o:"), col);
    }
  }
}

const SPECIES = [
  ["daisy", daisy, [[245, 245, 240], [255, 235, 245]], [14, 22]],
  ["cosmos", cosmos, [[255, 110, 170], [230, 80, 210], [255, 175, 205]], [15, 23]],
  ["poppy", poppy, [[245, 55, 45], [255, 135, 35], [255, 90, 120]], [12, 20]],
  ["lupine", lupine, [[150, 100, 255], [95, 115, 255], [240, 120, 210]], [16, 24]],
  ["lavender", lavender, [[175, 135, 240], [200, 160, 255]], [15, 22]],
  ["buttercup", buttercup, [[255, 220, 45], [255, 240, 120]], [10, 18]],
  ["cornflower", cornflower, [[70, 120, 255], [110, 90, 255]], [12, 20]],
  ["lace", lace, [[240, 240, 230], [255, 230, 240]], [14, 21]],
  ["susan", susan, [[255, 185, 25], [255, 150, 40]], [12, 20]],
  ["breath", breath, [[240, 240, 255], [200, 220, 255]], [13, 20]],
];

// ---- the bouquet -----------------------------------------------------------
function makeBouquet(day) {
  const seed = dateSeed(day);
  const rng = new Rng(seed);
  const pts = []; // [x, y, z, char|null, [r,g,b], tx, ty, tz]
  const add = (p, ch, col) => pts.push([p[0], p[1], p[2], ch, col, 0, 0, 0]);

  const idx = SPECIES.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const k = 4 + Math.floor(rng.next() * 4);
  const mix = idx.slice(0, k).map((i) => [SPECIES[i], rng.pick(SPECIES[i][2])]);

  const n = 16 + Math.floor(rng.next() * 9);
  const spin = rng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const [[, build, , [lmin, lmax]], col] = mix[Math.floor(rng.next() * mix.length)];
    const theta = spin + i * 2.39996 + rng.range(-0.3, 0.3);
    const phi = 0.1 + 0.68 * Math.sqrt((i + 0.5) / n) + rng.range(-0.08, 0.08);
    const L = rng.range(lmin, lmax) + 4;
    const ct = Math.cos(theta), st = Math.sin(theta);
    const r_ = Math.floor(rng.range(70, 120)), g_ = Math.floor(rng.range(165, 215)), b_ = Math.floor(rng.range(80, 120));
    const stemCol = [r_, g_, b_];
    const stemAt = (s) => {
      const ph = phi * (0.45 + 0.55 * s);
      return [L * s * Math.sin(ph) * ct, L * s * Math.cos(ph), L * s * Math.sin(ph) * st];
    };
    const steps = Math.floor(L * 2.6);
    for (let kk = 0; kk <= steps; kk++) {
      const s = kk / steps, p = stemAt(s);
      const q = stemAt(s < 1 ? Math.min(1, s + 0.02) : s - 0.02);
      const t = s < 1 ? norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]) : norm([p[0] - q[0], p[1] - q[1], p[2] - q[2]]);
      pts.push([p[0], p[1], p[2], null, stemCol, t[0], t[1], t[2]]);
    }
    if (rng.next() < 0.45) { // a leaf
      const s = rng.range(0.3, 0.6), p = stemAt(s), lt = rng.next() * TAU;
      for (let kk = 0; kk < 10; kk++) {
        const d = kk * 0.25;
        add([p[0] + d * Math.cos(lt), p[1] + d * 0.5 - 0.05 * kk * kk * 0.25, p[2] + d * Math.sin(lt)], "~", [80, 175, 95]);
      }
    }
    const head = stemAt(1), pre = stemAt(0.97);
    build(rng, head, norm([head[0] - pre[0], head[1] - pre[1], head[2] - pre[2]]), col, add);
  }

  const rib = rng.pick([[255, 120, 170], [255, 90, 90], [250, 240, 245], [170, 130, 255]]);
  for (let kk = 0; kk < 48; kk++) { const aa = kk * TAU / 48; add([Math.cos(aa), 3, Math.sin(aa)], "=", rib); }
  for (const side of [-1, 1]) {
    for (let kk = 0; kk < 26; kk++) {
      const aa = kk * TAU / 26;
      add([side * (1 + 1.1 * (1 - Math.cos(aa))), 3 + 0.9 * Math.sin(aa), 1], "%", rib);
    }
    for (let kk = 0; kk < 10; kk++) add([side * (0.4 + kk * 0.12), 2.6 - kk * 0.3, 1], "%", rib);
  }

  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cy = (y0 + y1) / 2;
  let radius = 0;
  for (const p of pts) radius = Math.max(radius, Math.hypot(p[0], p[1] - cy, p[2]));

  const stars = [];
  for (let i = 0; i < 45; i++) {
    const sx = rng.next(), sy = rng.next(), ph = rng.next() * TAU, sp = rng.range(1.5, 4.0);
    stars.push([sx, sy, ph, sp, rng.pick([[255, 255, 255], [255, 240, 170], [140, 255, 200], [255, 150, 200]])]);
  }
  const note = NOTES[(seed * 7) % NOTES.length];
  return { day, pts, cy, radius, stars, note, names: mix.map((m) => m[0][0]) };
}

// ---- rendering -------------------------------------------------------------
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// returns rows of [char, [r,g,b] | null]
function renderGrid(bq, W, H, angle, t, opts = {}) {
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => [" ", null]));
  const zbuf = Array.from({ length: H }, () => new Float64Array(W).fill(-1e9));

  for (const [sx, sy, ph, sp, col] of bq.stars) {
    const x = Math.floor(sx * W), y = Math.floor(sy * (H - 2));
    const v = Math.sin(t * sp + ph);
    if (v > 0.2) {
      const ch = v > 0.92 ? "*" : v > 0.75 ? "+" : v > 0.45 ? "." : "·";
      grid[y][x] = [ch, col.map((c) => Math.floor(c * (0.4 + 0.6 * v)))];
    }
  }

  const note = bq.note, d = bq.day;
  const date = `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  let caps = note.length + date.length + 5 <= W ? [`${note}  ·  ${date}`] : [note, date];
  if (opts.noCaption) caps = [];
  const rows = H - 1 - caps.length + (opts.noCaption ? 1 : 0);

  const D = bq.radius * 3.2, TILT = 0.28, ct = Math.cos(TILT), st = Math.sin(TILT);
  if (!bq.bounds) {
    let xm = 0, b0 = 1e9, b1 = -1e9;
    for (let k = 0; k < 16; k++) {
      const ca = Math.cos(k * TAU / 16), sa = Math.sin(k * TAU / 16);
      for (let i = 0; i < bq.pts.length; i += 3) {
        const [x, yy, z] = bq.pts[i], y = yy - bq.cy;
        const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct, f = D / (D - z2);
        xm = Math.max(xm, Math.abs(x1 * f)); b0 = Math.min(b0, y2 * f); b1 = Math.max(b1, y2 * f);
      }
    }
    bq.bounds = [xm, b0, b1];
  }
  const [xm, b0, b1] = bq.bounds;
  const scale = Math.min(rows * 0.96 / (b1 - b0), W * 0.48 / (xm * 2.0));
  const cx = W / 2, cy = rows / 2 + (b1 + b0) / 2 * scale;
  const ca = Math.cos(angle), sa = Math.sin(angle), R = bq.radius;

  for (const [x, yy, z, ch0, col, tx, ty, tz] of bq.pts) {
    const y = yy - bq.cy;
    const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
    const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    const f = scale * D / (D - z2);
    const px = Math.floor(cx + x1 * f * 2.0), py = Math.floor(cy - y2 * f);
    if (px >= 0 && px < W && py >= 0 && py < rows && z2 > zbuf[py][px]) {
      zbuf[py][px] = z2;
      let ch = ch0;
      if (ch === null) {
        const vx = (tx * ca + tz * sa) * 2.0;
        const vy = -(ty * ct - (-tx * sa + tz * ca) * st);
        if (Math.abs(vx) < 0.45 * Math.abs(vy)) ch = "|";
        else if (Math.abs(vy) < 0.45 * Math.abs(vx)) ch = "-";
        else ch = vx * vy < 0 ? "/" : "\\";
      }
      const light = 0.45 + 0.55 * Math.max(0, Math.min(1, (z2 + R) / (2 * R)));
      grid[py][px] = [ch, [Math.floor(col[0] * light), Math.floor(col[1] * light), Math.floor(col[2] * light)]];
    }
  }

  caps.forEach((cap, k) => {
    const start = Math.max(0, Math.floor((W - cap.length) / 2));
    for (let i = 0; i < Math.min(cap.length, W); i++) grid[H - caps.length + k][start + i] = [cap[i], [230, 120, 170]];
  });
  return grid;
}

// ---- Scriptable widget ----------------------------------------------------
// Paste the link to your hosted flowers page here (tapping the widget opens it):
const PAGE_URL = "https://goldyb320.github.io/flowers/";

const fam = config.widgetFamily || "large";
const SIZES = { small: [510, 510, 46], medium: [1092, 510, 86], large: [1092, 1146, 86], extraLarge: [2280, 1146, 150] };
const [PW, PH, COLS] = SIZES[fam] || SIZES.large;

const now = new Date();
const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const bq = makeBouquet(day);
// iOS refreshes widgets on its own schedule, so instead of a live spin the
// bouquet turns a little every time it refreshes over the day.
const angle = ((now - day) / 86400000) * TAU * 24;
const cell = PW / COLS, rows = Math.floor(PH * 0.86 / (cell * 2)); // margin so rounded corners don't clip
const grid = renderGrid(bq, COLS, rows, angle, now.getTime() / 1000, { noCaption: fam === "small" });

const dc = new DrawContext();
dc.size = new Size(PW, PH);
dc.respectScreenScale = false;
dc.setFillColor(new Color(`#${BG.map((c) => c.toString(16).padStart(2, "0")).join("")}`));
dc.fillRect(new Rect(0, 0, PW, PH));
dc.setFont(Font.boldMonospacedSystemFont(cell / 0.6));
const hex = (col) => new Color(`#${col.map((c) => c.toString(16).padStart(2, "0")).join("")}`);
const top = (PH - rows * cell * 2) / 2;
for (let y = 0; y < rows; y++) {
  let x = 0;
  while (x < COLS) {   // draw runs of same-colored characters in one call
    const [c, col] = grid[y][x];
    if (c === " " || !col) { x++; continue; }
    let s = c, x2 = x + 1;
    while (x2 < COLS && grid[y][x2][1] && grid[y][x2][0] !== " " && grid[y][x2][1].join() === col.join()) s += grid[y][x2++][0];
    dc.setTextColor(hex(col));
    dc.drawText(s, new Point(x * cell, top + y * cell * 2));
    x = x2;
  }
}

const w = new ListWidget();
w.backgroundImage = dc.getImage();
// tapping the widget runs this script in the app, which shows the spinning page
w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else await WebView.loadURL(PAGE_URL, null, true); // run in the app: show the spinning version
Script.complete();
