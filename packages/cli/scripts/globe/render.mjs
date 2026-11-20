// The GT globe as an armillary sphere of lit tori, rendered donut.c style.
// Each logo stroke is its own ring; the assembly turns while each ring swings
// on its own pivot, then everything locks into the logo pose and the G and T
// gaps open. Used by generate-frames.mjs; not shipped.
export const H = 25;
const W = H * 2;
const EXTENT = 1.2;
const SX = 3;
const SY = 6;
const GW = W * SX;
const GH = H * SY;
const TAU = Math.PI * 2;
const TUBE_SCALE = 1;
const LIGHT = norm([-0.35, 0.42, 0.85]);
const VIEW = [0, 0, 1];
const HALF = norm(LIGHT.map((c, i) => c + VIEW[i]));
const OUTLINE_SUBSAMPLES = 3;
const OUTLINE_DEPTH = 0.03;
const SOLID = new Set(['frame', 'equator']);
const STACKING = { meridian: 2, bowl: 1 };

function norm(v) {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const rotAxis = (p, k, a) => {
  // Rodrigues rotation of p about unit axis k by angle a.
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kxp = cross(k, p);
  const kdp = dot(k, p);
  return p.map((v, i) => v * c + kxp[i] * s + k[i] * kdp * (1 - c));
};
const wrap = (t) => Math.atan2(Math.sin(t), Math.cos(t));

// Rings in the final logo pose. Gaps are [center, halfWidth] in ring angle and
// open as the animation settles. Pivot is the axis each ring swings on.
const SIN_TILT = 0.565;
const COS_TILT = Math.sqrt(1 - SIN_TILT ** 2);
const RINGS = [
  {
    name: 'frame',
    e1: [1, 0, 0],
    e2: [0, 1, 0],
    radius: 1.07,
    tube: 0.07 * TUBE_SCALE,
    gaps: [],
    pivot: [1, 0, 0],
    swing: 0,
  },
  {
    name: 'meridian',
    e1: [0, 1, 0],
    e2: [-0.64, 0, 0.77],
    radius: 0.93,
    tube: 0.072 * TUBE_SCALE,
    gaps: [[-1.55, 0.7]],
    pivot: [0, 1, 0],
    swing: 1.4,
  },
  {
    name: 'bowl',
    e1: [1, 0, 0],
    e2: [0, SIN_TILT, -COS_TILT],
    radius: 0.9,
    tube: 0.072 * TUBE_SCALE,
    gaps: [[0.32, 0.44]],
    pivot: [1, 0, 0],
    swing: -1.1,
  },
  {
    name: 'equator',
    e1: [1, 0, 0],
    e2: [0, 0, 1],
    radius: 0.91,
    tube: 0.072 * TUBE_SCALE,
    gaps: [[Math.PI, 1.02]],
    pivot: [1, 0, 0],
    swing: 0.9,
  },
  {
    name: 'stem',
    e1: [0, 1, 0],
    e2: [0, 0, 1],
    radius: 0.87,
    tube: 0.072 * TUBE_SCALE,
    gaps: [
      [-Math.PI / 4, (3 * Math.PI) / 4],
      [2.175, 0.175],
    ],
    pivot: [0, 1, 0],
    swing: -1.8,
  },
].map((r) => ({ ...r, e1: norm(r.e1), e2: norm(r.e2) }));

function inGap(t, gaps, open) {
  return gaps.some(([c, hw]) => Math.abs(wrap(t - c)) < hw * open);
}

const THETA_STEPS = 900;
const PHI_STEPS = 44;

// Render one frame into a subsample z-buffer, then fold it into characters.
export function frame({ spin = 0, tilt = 0, swing = 0, open = 1 } = {}) {
  const depth = new Float32Array(GW * GH).fill(-Infinity);
  const light = new Float32Array(GW * GH);
  const owner = new Int8Array(GW * GH).fill(-1);
  const spine = new Float32Array(GW * GH);
  const toView = (p) => rotAxis(rotAxis(p, [0, 1, 0], spin), [1, 0, 0], tilt);

  RINGS.forEach((ring, id) => {
    const pose = (v) => toView(rotAxis(v, ring.pivot, ring.swing * swing));
    const e1 = pose(ring.e1);
    const e2 = pose(ring.e2);
    const axis = cross(e1, e2);
    for (let a = 0; a < THETA_STEPS; a++) {
      const t = (a / THETA_STEPS) * TAU - Math.PI;
      if (inGap(t, ring.gaps, open)) continue;
      const radial = e1.map((v, i) => v * Math.cos(t) + e2[i] * Math.sin(t));
      for (let b = 0; b < PHI_STEPS; b++) {
        const f = (b / PHI_STEPS) * TAU;
        const n = radial.map((v, i) => v * Math.cos(f) + axis[i] * Math.sin(f));
        if (n[2] < 0.05) continue;
        const p = radial.map((v, i) => v * ring.radius + n[i] * ring.tube);
        const gx = Math.floor(((p[0] / EXTENT + 1) / 2) * GW);
        const gy = Math.floor(((1 - p[1] / EXTENT) / 2) * GH);
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const k = gy * GW + gx;
        if (p[2] <= depth[k]) continue;
        depth[k] = p[2];
        owner[k] = id;
        spine[k] = radial[2] * ring.radius;
        const diffuse = (0.5 + 0.5 * dot(n, LIGHT)) ** 2;
        const spec = Math.max(0, dot(n, HALF)) ** 24;
        light[k] = clamp01(0.32 + 0.55 * diffuse + 0.45 * spec);
      }
    }
  });

  // Where a nearer ring crosses a farther one, cut a thin gap in the farther
  // ring so the crossing reads as over/under, like the logo's weave. Depth is
  // compared along the rings' centerlines, so a thick tube's bulge can't carve
  // a ring it runs beside; near-ties follow the logo's stacking order. As in
  // the logo, the frame and the bar are never cut and cut nothing, and the
  // T's stem never cuts.
  const cut = new Uint8Array(GW * GH);
  const reach = Math.max(2, Math.round((OUTLINE_SUBSAMPLES * H) / 25));
  const cuttable = (id) => id >= 0 && !SOLID.has(RINGS[id].name);
  const cutter = (id) => cuttable(id) && RINGS[id].name !== 'stem';
  const rank = (id) => STACKING[RINGS[id].name] ?? 0;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const k = y * GW + x;
      if (!cuttable(owner[k])) continue;
      search: for (let dy = -reach * 2; dy <= reach * 2; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
          const j = yy * GW + xx;
          if (owner[j] === owner[k] || !cutter(owner[j])) continue;
          const nearer = spine[j] - spine[k];
          const tie = Math.abs(nearer) <= OUTLINE_DEPTH;
          if (
            nearer > OUTLINE_DEPTH ||
            (tie && rank(owner[j]) > rank(owner[k]))
          ) {
            cut[k] = 1;
            break search;
          }
        }
      }
    }
  }

  const cells = [];
  for (let row = 0; row < H; row++) {
    const line = [];
    for (let col = 0; col < W; col++) {
      let cover = 0;
      let sum = 0;
      for (let j = 0; j < SY; j++) {
        for (let i = 0; i < SX; i++) {
          const k = (row * SY + j) * GW + col * SX + i;
          if (owner[k] < 0 || cut[k]) continue;
          cover++;
          sum += light[k];
        }
      }
      line.push(shade(cover / (SX * SY), cover ? sum / cover : 0));
    }
    cells.push(line);
  }
  return cells;
}

// A cell as one byte: 0 when empty, otherwise 1 + char * SUBLEVELS + sub,
// where char indexes the 12-character ramp exactly and sub places the cell's
// brightness within that character's band for its color. The CLI decodes it
// in src/console/globe/paint.ts.
const RAMP_LENGTH = 12;
const SUBLEVELS = 21;
function shade(cover, l) {
  if (cover < 0.28) return 0;
  const level = clamp01(l * (0.7 + 0.3 * Math.min(1, cover * 1.4))) ** 0.85;
  const scaled = level * (RAMP_LENGTH - 1);
  const char = Math.round(scaled);
  const sub = Math.min(
    SUBLEVELS - 1,
    Math.max(0, Math.floor((scaled - (char - 0.5)) * SUBLEVELS))
  );
  return 1 + char * SUBLEVELS + sub;
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeOutBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
export function timeline(count = 54) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    const e = easeOutCubic(t);
    return {
      spin: -TAU * (1 - e),
      tilt: 0.42 * (1 - e),
      swing: 1 - easeOutBack(clamp01(t / 0.85)),
      open: clamp01((t - 0.62) / 0.3),
    };
  });
}

const smootherstep = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// One loop cycle: rings swing out and the gaps close, the assembly turns once,
// then the rings swing home and the gaps reopen. Starts and ends on the logo.
export function cycle(count = 96) {
  return Array.from({ length: count }, (_, i) => {
    const u = (i + 1) / count;
    const swing =
      u <= 0.35
        ? smootherstep(u / 0.35)
        : u < 0.5
          ? 1
          : 1 - easeOutBack((u - 0.5) / 0.5);
    const open =
      u < 0.25
        ? 1 - smootherstep(u / 0.2)
        : u < 0.7
          ? 0
          : smootherstep((u - 0.7) / 0.3);
    // A full turn is exactly zero, so the loop lands on the resting frame
    // without floating-point error flipping cells.
    return {
      spin: (TAU * smootherstep(u)) % TAU,
      tilt: u === 1 ? 0 : 0.42 * Math.sin(Math.PI * u) ** 2,
      swing,
      open,
    };
  });
}
