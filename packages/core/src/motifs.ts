/**
 * The drawings each festival is dressed in.
 *
 * A colour alone says "orange", not "Deepavali". What says Deepavali is a
 * lamp; Eid is a crescent and a lantern; Christmas a star; Onam a flower
 * carpet; Independence Day three bands of colour. So every look in
 * festivals.ts names one of these, and both apps draw it from the same data:
 * large and faint behind an event's title, small and whole on its tile.
 *
 * Symbols a festival is decorated with, never the sacred ones: a diya but no
 * deity, lanterns and a crescent but no calligraphy, three bands of colour but
 * not the flag itself or the national emblem, whose use the law restricts.
 * A day of mourning is drawn with nothing at all.
 *
 * Everything is on a 120 × 120 canvas. Outlines keep a fixed hairline width
 * whatever the size, so they read on a 44-point tile and stay fine on a hero.
 */

export type MotifId =
  | 'none'
  | 'dots'
  | 'diya'
  | 'gulal'
  | 'garland'
  | 'modak'
  | 'pookalam'
  | 'pot'
  | 'kite'
  | 'bonfire'
  | 'sheaf'
  | 'feather'
  | 'rakhi'
  | 'kolam'
  | 'toran'
  | 'bathukamma'
  | 'sun'
  | 'crescent'
  | 'star'
  | 'lily'
  | 'lights'
  | 'lotus'
  | 'fireworks'
  | 'tricolour'
  | 'charkha'
  | 'trophy'
  | 'music'
  | 'balloons'
  | 'heart'
  | 'leaf'
  | 'thali'
  | 'confetti';

/**
 * How a path is painted. `line` is the motif's own colour (white on a hero,
 * the festival colour on a pale tile), `soft` a faint wash of it, and `light`
 * a warm glow for anything that gives light: a flame, a star, a lantern.
 *
 * Those three are the whole palette. Every drawing is a fine line, a faint
 * wash and one gold light, the way an invitation card is printed, so a
 * festival looks dressed rather than drawn for children; the colour belongs
 * to the banner behind it. The one hex value is the tricolour's bands, which
 * cannot be any other colours.
 */
export type MotifPaint = 'line' | 'soft' | 'light' | `#${string}`;

export type MotifPath = {
  d: string;
  stroke?: MotifPaint;
  fill?: MotifPaint;
  /** On top of the paint's own opacity. */
  opacity?: number;
  /** Outline width in points, the same at any size. */
  width?: number;
};

/**
 * Movement a layer is given. Each is a loop that starts and ends where the
 * drawing is at rest, so with reduced motion the motif is simply still.
 */
export type MotifMotion =
  | 'flicker' // a flame
  | 'twinkle' // a star, a light, a sparkle
  | 'sway' // leaves, a feather, a strand of flowers
  | 'swing' // a lantern on its string
  | 'drift' // a cloud of colour
  | 'bloom' // a firework opening
  | 'float' // a balloon, a note, a kite
  | 'turn' // a kolam, a flower carpet, a wheel
  | 'rise' // steam, embers
  | 'wave' // water, a ribbon
  | 'pulse' // a glow breathing
  | 'fall'; // petals, confetti

export type MotifLayer = {
  paths: readonly MotifPath[];
  motion?: MotifMotion;
  /** The point it moves about, on the 120 × 120 canvas. */
  origin?: readonly [number, number];
  /** Seconds, so layers of one motif do not move in step. */
  delay?: number;
  /** Left off the small tile, where it would only be clutter. */
  detail?: boolean;
};

export type Motif = {
  id: MotifId;
  layers: readonly MotifLayer[];
  /**
   * The part of the canvas a small tile shows, as x, y, width, height, when
   * the whole of it would leave the drawing a speck: a string of lamps along
   * the bottom, a toran along the top.
   */
  frame?: readonly [number, number, number, number];
};

// ---------------------------------------------------------------- geometry

const r2 = (value: number) => Math.round(value * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
}

/** An ellipse as a path, optionally turned by `rotate` degrees. */
export function ellipse(cx: number, cy: number, rx: number, ry = rx, rotate = 0) {
  const angle = (rotate * Math.PI) / 180;
  const dx = Math.cos(angle) * rx;
  const dy = Math.sin(angle) * rx;
  const start = pt(cx - dx, cy - dy);
  const end = pt(cx + dx, cy + dy);
  const arc = `A${r2(rx)} ${r2(ry)} ${rotate} 1 0`;
  return `M${start}${arc} ${end}${arc} ${start}Z`;
}

const circle = (cx: number, cy: number, radius: number) => ellipse(cx, cy, radius);

/** A star with `points` points, the first pointing straight up. */
function star(cx: number, cy: number, points: number, outer: number, inner: number) {
  const corners: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const [x, y] = polar(cx, cy, index % 2 ? inner : outer, -90 + (index * 180) / points);
    corners.push(pt(x, y));
  }
  return `M${corners.join('L')}Z`;
}

/** A four-pointed sparkle with curved sides. */
function sparkle(cx: number, cy: number, size: number) {
  const c = pt(cx, cy);
  return (
    `M${pt(cx, cy - size)}Q${c} ${pt(cx + size, cy)}Q${c} ${pt(cx, cy + size)}` +
    `Q${c} ${pt(cx - size, cy)}Q${c} ${pt(cx, cy - size)}Z`
  );
}

/** A petal from `radius` out to `radius + length`, `width` radians either side. */
function petal(
  cx: number,
  cy: number,
  degrees: number,
  radius: number,
  length: number,
  width: number,
) {
  const angle = (degrees * Math.PI) / 180;
  const at = (distance: number, turn: number) =>
    pt(cx + Math.cos(angle + turn) * distance, cy + Math.sin(angle + turn) * distance);
  const middle = radius + length * 0.55;
  return (
    `M${at(radius, 0)}Q${at(middle, -width)} ${at(radius + length, 0)}` +
    `Q${at(middle, width)} ${at(radius, 0)}Z`
  );
}

/** `count` petals evenly round a centre, as one path. */
function ring(
  cx: number,
  cy: number,
  count: number,
  radius: number,
  length: number,
  width: number,
  offset = 0,
) {
  let path = '';
  for (let index = 0; index < count; index += 1) {
    path += petal(cx, cy, offset + (index * 360) / count, radius, length, width);
  }
  return path;
}

/** Dots evenly round a circle, as one path. */
function dotRing(cx: number, cy: number, count: number, radius: number, size: number, offset = 0) {
  let path = '';
  for (let index = 0; index < count; index += 1) {
    const [x, y] = polar(cx, cy, radius, offset + (index * 360) / count);
    path += circle(x, y, size);
  }
  return path;
}

/** A smooth closed curve through `points` (Catmull-Rom, as cubic Béziers). */
function smooth(points: readonly (readonly [number, number])[], closed = true) {
  const count = points.length;
  const at = (index: number) =>
    closed ? points[(index + count) % count]! : points[Math.max(0, Math.min(count - 1, index))]!;
  let path = `M${pt(...points[0]!)}`;
  const last = closed ? count : count - 1;
  for (let index = 0; index < last; index += 1) {
    const [x0, y0] = at(index - 1);
    const [x1, y1] = at(index);
    const [x2, y2] = at(index + 1);
    const [x3, y3] = at(index + 2);
    path +=
      `C${pt(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6)} ` +
      `${pt(x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6)} ${pt(x2, y2)}`;
  }
  return closed ? `${path}Z` : path;
}

/** A soft irregular blob, for a cloud of colour. */
function blob(cx: number, cy: number, radius: number, wobble: readonly number[]) {
  const points = wobble.map((scale, index) =>
    polar(cx, cy, radius * scale, (index * 360) / wobble.length),
  );
  return smooth(points);
}

/** A point on a quadratic Bézier, for hanging things along a string. */
function onCurve(
  from: readonly [number, number],
  control: readonly [number, number],
  to: readonly [number, number],
  t: number,
) {
  const u = 1 - t;
  return [
    u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
    u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
  ] as const;
}

/** A leaf hanging from (x, y), `length` long. */
function hangingLeaf(x: number, y: number, length: number, width: number, lean = 0) {
  const tip = [x + lean, y + length] as const;
  return (
    `M${pt(x, y)}C${pt(x + width, y + length * 0.3)} ${pt(tip[0] + width * 0.6, y + length * 0.75)} ${pt(...tip)}` +
    `C${pt(tip[0] - width * 0.6, y + length * 0.75)} ${pt(x - width, y + length * 0.3)} ${pt(x, y)}Z`
  );
}

/** A flame standing on (x, y), `height` tall. */
function flame(x: number, y: number, height: number, width: number) {
  const top = y - height;
  return (
    `M${pt(x, top)}C${pt(x + width * 0.9, top + height * 0.35)} ${pt(x + width * 1.1, top + height * 0.62)} ${pt(x + width * 0.62, top + height * 0.85)}` +
    `C${pt(x + width * 0.4, y)} ${pt(x - width * 0.4, y)} ${pt(x - width * 0.62, top + height * 0.85)}` +
    `C${pt(x - width * 1.1, top + height * 0.62)} ${pt(x - width * 0.9, top + height * 0.35)} ${pt(x, top)}Z`
  );
}

/** A small clay lamp with its flame, centred on (x, y) — the rim's middle. */
function smallDiya(x: number, y: number, scale: number): MotifPath[] {
  const s = scale;
  return [
    {
      d: `M${pt(x - 11 * s, y)}C${pt(x - 9 * s, y + 7 * s)} ${pt(x + 9 * s, y + 7 * s)} ${pt(x + 11 * s, y)}Z`,
      stroke: 'line',
      fill: 'soft',
    },
  ];
}

// ------------------------------------------------------------------ motifs

const SPARKLES = (spots: readonly (readonly [number, number, number])[], start = 0): MotifLayer[] =>
  spots.map(([x, y, size], index) => ({
    paths: [{ d: sparkle(x, y, size), fill: 'line' }],
    motion: 'twinkle',
    origin: [x, y],
    delay: start + index * 0.9,
    detail: true,
  }));

const diya: Motif = {
  id: 'diya',
  layers: [
    {
      paths: [{ d: circle(60, 52, 26), fill: 'light', opacity: 0.14 }],
      motion: 'pulse',
      origin: [60, 52],
      detail: true,
    },
    {
      paths: [
        { d: 'M22 70C25 87 42 95 60 95C78 95 95 87 98 70', stroke: 'line', fill: 'soft' },
        { d: ellipse(60, 70, 38, 6), stroke: 'line' },
        { d: 'M45 95.5C47 100.5 73 100.5 75 95.5', stroke: 'line' },
        { d: 'M31 80C44 87 76 87 89 80', stroke: 'line', opacity: 0.55 },
        { d: circle(46, 87.5, 1.5) + circle(60, 90, 1.5) + circle(74, 87.5, 1.5), fill: 'line' },
        { d: 'M60 63V70', stroke: 'line' },
      ],
    },
    {
      paths: [
        { d: flame(60, 66, 36, 9), fill: 'light' },
        { d: flame(60, 63, 19, 4.6), fill: 'line', opacity: 0.85 },
      ],
      motion: 'flicker',
      origin: [60, 66],
    },
    ...SPARKLES([
      [22, 30, 5],
      [98, 26, 4],
      [92, 50, 3],
      [30, 52, 2.6],
    ]),
  ],
};

const gulal: Motif = {
  id: 'gulal',
  layers: [
    {
      paths: [
        {
          d: blob(46, 50, 23, [1, 0.86, 1.08, 0.9, 1.04, 0.84, 1.1, 0.92]),
          stroke: 'line',
          fill: 'soft',
        },
      ],
      motion: 'drift',
      origin: [46, 50],
    },
    {
      paths: [
        {
          d: blob(84, 40, 17, [0.9, 1.08, 0.86, 1.02, 0.92, 1.1, 0.88]),
          stroke: 'line',
          fill: 'light',
          opacity: 0.9,
        },
      ],
      motion: 'drift',
      origin: [84, 40],
      delay: 1.6,
    },
    {
      paths: [
        {
          d: blob(76, 82, 21, [1.04, 0.88, 1, 1.1, 0.86, 0.98, 1.06, 0.9]),
          stroke: 'line',
          fill: 'soft',
        },
      ],
      motion: 'drift',
      origin: [76, 82],
      delay: 3.1,
    },
    {
      paths: [
        { d: blob(36, 88, 11, [1, 0.84, 1.1, 0.9, 1.02, 0.88]), stroke: 'line', fill: 'soft' },
        {
          d: circle(20, 30, 2.4) + circle(68, 18, 1.8) + circle(106, 62, 2.2) + circle(22, 66, 1.6),
          fill: 'light',
        },
        {
          d:
            circle(100, 20, 2) +
            circle(56, 104, 2.2) +
            circle(104, 100, 1.6) +
            circle(60, 30, 1.6) +
            circle(96, 88, 2.4) +
            circle(14, 46, 1.8),
          fill: 'line',
          opacity: 0.8,
        },
      ],
      motion: 'drift',
      origin: [60, 60],
      delay: 0.8,
      detail: true,
    },
  ],
};

/** A marigold: a gold bead with a darker heart. */
const marigold = (x: number, y: number, size: number): MotifPath[] => [
  { d: circle(x, y, size), fill: 'light' },
  { d: circle(x, y, size * 0.48), stroke: 'line', opacity: 0.55, width: 1 },
];

function strand(x: number, top: number, beads: number, gap: number, size: number): MotifLayer {
  const paths: MotifPath[] = [
    { d: `M${pt(x, top)}V${r2(top + beads * gap + 6)}`, stroke: 'line', opacity: 0.7 },
  ];
  for (let index = 0; index < beads; index += 1) {
    paths.push(...marigold(x, top + gap * (index + 0.7), size));
  }
  const end = top + beads * gap + 6;
  paths.push({
    d: `M${pt(x, end)}L${pt(x - 3, end + 7)}M${pt(x, end)}L${pt(x, end + 8)}M${pt(x, end)}L${pt(x + 3, end + 7)}`,
    stroke: 'line',
  });
  return { paths, motion: 'sway', origin: [x, top] };
}

const garland: Motif = {
  id: 'garland',
  frame: [4, 8, 112, 104],
  layers: [
    {
      paths: [
        { d: 'M-4 14Q30 34 60 14Q90 34 124 14', stroke: 'line' },
        { d: hangingLeaf(14, 19, 16, 5, -2) + hangingLeaf(106, 19, 16, 5, 2), fill: 'soft' },
        {
          d: hangingLeaf(14, 19, 16, 5, -2) + hangingLeaf(106, 19, 16, 5, 2),
          stroke: 'line',
        },
        { d: hangingLeaf(45, 21, 14, 4.5, -1) + hangingLeaf(75, 21, 14, 4.5, 1), fill: 'soft' },
        {
          d: hangingLeaf(45, 21, 14, 4.5, -1) + hangingLeaf(75, 21, 14, 4.5, 1),
          stroke: 'line',
        },
      ],
    },
    { ...strand(30, 23, 5, 11, 4.6), delay: 0 },
    { ...strand(60, 14, 7, 11, 5), delay: 0.7 },
    { ...strand(90, 23, 5, 11, 4.6), delay: 1.4 },
  ],
};

function modakShape(cx: number, base: number, s: number) {
  const top = base - 64 * s;
  const x = (dx: number) => r2(cx + dx * s);
  const y = (dy: number) => r2(base - dy * s);
  const outline =
    `M${pt(cx, top)}C${x(3)} ${y(54)} ${x(12)} ${y(48)} ${x(22)} ${y(38)}` +
    `C${x(32)} ${y(28)} ${x(32)} ${y(8)} ${x(16)} ${y(1.5)}` +
    `C${x(8)} ${y(-1)} ${x(-8)} ${y(-1)} ${x(-16)} ${y(1.5)}` +
    `C${x(-32)} ${y(8)} ${x(-32)} ${y(28)} ${x(-22)} ${y(38)}` +
    `C${x(-12)} ${y(48)} ${x(-3)} ${y(54)} ${pt(cx, top)}Z`;
  const pleats = [-21, -11, 0, 11, 21]
    .map(
      (dx) =>
        `M${pt(cx, top)}C${x(dx * 0.35)} ${y(46)} ${x(dx * 1.05)} ${y(30)} ${x(dx * 0.8)} ${y(dx === 0 ? 0 : Math.abs(dx) > 15 ? 5 : 1)}`,
    )
    .join('');
  return { outline, pleats };
}

const modakBig = modakShape(60, 96, 1);
const modakLeft = modakShape(28, 98, 0.52);
const modakRight = modakShape(92, 98, 0.52);

const modak: Motif = {
  id: 'modak',
  layers: [
    {
      paths: [{ d: circle(60, 66, 36), fill: 'light', opacity: 0.12 }],
      motion: 'pulse',
      origin: [60, 66],
      detail: true,
    },
    {
      paths: [
        { d: modakLeft.outline + modakRight.outline, stroke: 'line', fill: 'soft' },
        { d: modakLeft.pleats + modakRight.pleats, stroke: 'line', opacity: 0.6 },
      ],
      detail: true,
    },
    {
      paths: [
        { d: modakBig.outline, stroke: 'line', fill: 'soft' },
        { d: modakBig.pleats, stroke: 'line', opacity: 0.7 },
        { d: ellipse(60, 100, 44, 5.5), stroke: 'line' },
      ],
    },
    {
      paths: [
        { d: ring(26, 30, 5, 2.5, 11, 0.62, -90), stroke: 'line', fill: 'soft' },
        { d: `M26 30L${pt(...polar(26, 30, 14, -40))}`, stroke: 'light', width: 1.2 },
        { d: circle(...polar(26, 30, 14, -40), 1.5), fill: 'light' },
      ],
      motion: 'sway',
      origin: [26, 30],
      detail: true,
    },
    ...SPARKLES(
      [
        [100, 26, 4.5],
        [88, 46, 2.8],
      ],
      0.4,
    ),
  ],
};

const pookalam: Motif = {
  id: 'pookalam',
  layers: [
    {
      paths: [
        { d: circle(60, 60, 55), stroke: 'line', opacity: 0.8 },
        { d: dotRing(60, 60, 28, 51, 1.3), fill: 'line' },
        { d: ring(60, 60, 20, 38, 12, 0.16, 9), fill: 'light', opacity: 0.9 },
        { d: ring(60, 60, 16, 26, 13, 0.2), stroke: 'line', fill: 'soft' },
        { d: ring(60, 60, 12, 15, 12, 0.26, 15), stroke: 'line', opacity: 0.8 },
        { d: ring(60, 60, 8, 5, 11, 0.36), fill: 'soft' },
        { d: circle(60, 60, 5), fill: 'light' },
        { d: circle(60, 60, 2), fill: 'line' },
      ],
      motion: 'turn',
      origin: [60, 60],
    },
  ],
};

const pot: Motif = {
  id: 'pot',
  layers: [
    {
      paths: [
        {
          d: 'M24 112L36 22M22 94l5 1M25 74l5 1M28 54l5 1M31 34l5 1M96 112L84 22M98 94l-5 1M95 74l-5 1M92 54l-5 1M89 34l-5 1',
          stroke: 'line',
        },
        {
          d: 'M36 22C28 12 18 12 10 16M36 22C38 10 46 6 54 6M84 22C92 12 102 12 110 16M84 22C82 10 74 6 66 6',
          stroke: 'line',
        },
      ],
      motion: 'sway',
      origin: [60, 112],
      detail: true,
    },
    {
      paths: [
        {
          d: 'M46 58C44 62 30 68 30 82C30 94 44 101 60 101C76 101 90 94 90 82C90 68 76 62 74 58Z',
          stroke: 'line',
          fill: 'soft',
        },
        { d: ellipse(60, 57, 15, 3.2), stroke: 'line' },
        {
          d: 'M34 76L40 70L46 76L52 70L58 76L64 70L70 76L76 70L82 76L86 72',
          stroke: 'light',
          width: 1.6,
        },
        {
          d: 'M44 56C41 48 49 45 52 49C54 41 65 41 67 47C71 42 80 46 76 56',
          stroke: 'line',
          fill: 'soft',
        },
      ],
    },
    ...[
      [52, 0],
      [60, 1.1],
      [68, 2.2],
    ].map(([x, delay]): MotifLayer => ({
      paths: [
        {
          d: `M${pt(x!, 40)}C${pt(x! - 4, 34)} ${pt(x! + 4, 30)} ${pt(x!, 24)}`,
          stroke: 'line',
          opacity: 0.7,
        },
      ],
      motion: 'rise',
      origin: [x!, 32],
      delay,
      detail: true,
    })),
  ],
};

function kiteShape(
  cx: number,
  top: number,
  s: number,
  left: MotifPaint,
  right: MotifPaint,
): MotifPath[] {
  const x = (dx: number) => r2(cx + dx * s);
  const y = (dy: number) => r2(top + dy * s);
  return [
    { d: `M${x(0)} ${y(0)}L${x(-21)} ${y(24)}L${x(0)} ${y(54)}Z`, fill: left },
    { d: `M${x(0)} ${y(0)}L${x(21)} ${y(24)}L${x(0)} ${y(54)}Z`, fill: right },
    {
      d: `M${x(0)} ${y(0)}L${x(21)} ${y(24)}L${x(0)} ${y(54)}L${x(-21)} ${y(24)}Z M${x(0)} ${y(0)}V${y(54)}M${x(-21)} ${y(24)}Q${x(0)} ${y(15)} ${x(21)} ${y(24)}`,
      stroke: 'line',
    },
    { d: `M${x(0)} ${y(54)}L${x(-5)} ${y(63)}L${x(5)} ${y(63)}Z`, fill: left },
  ];
}

const kite: Motif = {
  id: 'kite',
  layers: [
    {
      paths: [
        { d: 'M44 72C40 92 26 104 2 118', stroke: 'line', opacity: 0.6 },
        { d: 'M88 94C84 106 76 112 64 120', stroke: 'line', opacity: 0.6 },
      ],
      detail: true,
    },
    {
      paths: kiteShape(44, 16, 1, 'light', 'soft'),
      motion: 'float',
      origin: [44, 44],
    },
    {
      paths: kiteShape(88, 58, 0.66, 'soft', 'light'),
      motion: 'float',
      origin: [88, 76],
      delay: 1.3,
      detail: true,
    },
    {
      paths: [
        {
          d: 'M98 14L104 22L98 31L92 22ZM76 8L80 13L76 19L72 13Z',
          stroke: 'line',
          opacity: 0.7,
        },
      ],
      motion: 'float',
      origin: [88, 16],
      delay: 2.2,
      detail: true,
    },
  ],
};

const bonfire: Motif = {
  id: 'bonfire',
  layers: [
    {
      paths: [{ d: circle(60, 76, 34), fill: 'light', opacity: 0.12 }],
      motion: 'pulse',
      origin: [60, 76],
      detail: true,
    },
    {
      paths: [
        { d: 'M26 104L94 86M26 86L94 104', stroke: 'line', width: 2.4 },
        {
          d: circle(26, 104, 3) + circle(94, 86, 3) + circle(26, 86, 3) + circle(94, 104, 3),
          stroke: 'line',
        },
        { d: ellipse(60, 108, 40, 4), stroke: 'line', opacity: 0.5 },
      ],
    },
    {
      paths: [
        { d: flame(60, 96, 56, 16), fill: 'light' },
        { d: flame(44, 96, 32, 9), fill: 'light', opacity: 0.85 },
        { d: flame(77, 96, 36, 10), fill: 'light', opacity: 0.85 },
        { d: flame(60, 94, 28, 7), fill: 'line', opacity: 0.85 },
      ],
      motion: 'flicker',
      origin: [60, 96],
    },
    ...[
      [48, 34, 0],
      [70, 24, 0.9],
      [80, 42, 1.8],
      [40, 48, 2.6],
    ].map(([x, y, delay]): MotifLayer => ({
      paths: [{ d: circle(x!, y!, 1.8), fill: 'light' }],
      motion: 'rise',
      origin: [x!, y!],
      delay,
      detail: true,
    })),
  ],
};

function sheafPaths(): MotifPath[] {
  const tie = [60, 72] as const;
  const tips = [
    [30, 22],
    [44, 12],
    [60, 8],
    [76, 12],
    [90, 22],
  ] as const;
  const feet = [
    [44, 112],
    [52, 114],
    [60, 114],
    [68, 114],
    [76, 112],
  ] as const;
  let stalks = '';
  let grains = '';
  for (const [x, y] of tips) {
    stalks += `M${pt(...tie)}L${pt(x, y)}`;
    const dx = tie[0] - x;
    const dy = tie[1] - y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const degrees = (Math.atan2(uy, ux) * 180) / Math.PI;
    for (const t of [0.04, 0.14, 0.24, 0.34]) {
      const gx = x + dx * t;
      const gy = y + dy * t;
      grains += ellipse(gx - uy * 3, gy + ux * 3, 4.2, 1.9, degrees + 35);
      grains += ellipse(gx + uy * 3, gy - ux * 3, 4.2, 1.9, degrees - 35);
    }
  }
  for (const [x, y] of feet) stalks += `M${pt(...tie)}L${pt(x, y)}`;
  return [
    { d: stalks, stroke: 'line' },
    { d: grains, fill: 'light' },
    { d: ellipse(60, 72, 9, 3.6), stroke: 'line', fill: 'soft' },
    { d: 'M60 72C54 66 50 72 54 76M60 72C66 66 70 72 66 76', stroke: 'line' },
  ];
}

const sheaf: Motif = {
  id: 'sheaf',
  layers: [
    {
      paths: [{ d: circle(60, 40, 30), fill: 'light', opacity: 0.1 }],
      motion: 'pulse',
      origin: [60, 40],
      detail: true,
    },
    { paths: sheafPaths(), motion: 'sway', origin: [60, 114] },
  ],
};

function flutePaths(): MotifPath[] {
  const from = [12, 100] as const;
  const to = [108, 44] as const;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  const nx = (-dy / length) * 3.2;
  const ny = (dx / length) * 3.2;
  const body =
    `M${pt(from[0] + nx, from[1] + ny)}L${pt(to[0] + nx, to[1] + ny)}` +
    `A3.2 3.2 0 0 0 ${pt(to[0] - nx, to[1] - ny)}L${pt(from[0] - nx, from[1] - ny)}` +
    `A3.2 3.2 0 0 0 ${pt(from[0] + nx, from[1] + ny)}Z`;
  let holes = '';
  for (const t of [0.46, 0.54, 0.62, 0.7, 0.78]) {
    holes += circle(from[0] + dx * t, from[1] + dy * t, 1.1);
  }
  let bands = '';
  for (const t of [0.12, 0.16, 0.9]) {
    const x = from[0] + dx * t;
    const y = from[1] + dy * t;
    bands += `M${pt(x + nx, y + ny)}L${pt(x - nx, y - ny)}`;
  }
  return [
    { d: body, stroke: 'line', fill: 'soft' },
    { d: holes, fill: 'line' },
    { d: bands, stroke: 'light', width: 1.4 },
  ];
}

function featherPaths(): MotifPath[] {
  let barbs = '';
  for (let index = 0; index < 9; index += 1) {
    const t = 0.18 + index * 0.08;
    const y = 104 - t * 88;
    const x = 66 - t * 12;
    const spread = 14 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    barbs += `M${pt(x, y)}Q${pt(x + spread * 0.6, y - 6)} ${pt(x + spread, y - 14)}`;
    barbs += `M${pt(x, y)}Q${pt(x - spread * 0.6, y - 6)} ${pt(x - spread, y - 14)}`;
  }
  return [
    { d: 'M55 14C80 24 82 60 66 92C44 62 40 30 55 14Z', fill: 'soft' },
    { d: barbs, stroke: 'line', opacity: 0.55 },
    { d: 'M67 110C65 82 61 52 55 18', stroke: 'line' },
    { d: ellipse(57, 36, 13, 16, -10), fill: 'soft' },
    { d: ellipse(57.6, 38, 9, 11, -10), fill: 'light', opacity: 0.9 },
    { d: ellipse(58, 40, 4.6, 5.8, -10), stroke: 'line', fill: 'soft' },
    { d: ellipse(57, 36, 13, 16, -10), stroke: 'light', width: 1 },
  ];
}

const feather: Motif = {
  id: 'feather',
  layers: [
    { paths: flutePaths() },
    { paths: featherPaths(), motion: 'sway', origin: [67, 110] },
    ...SPARKLES([
      [98, 20, 4],
      [24, 34, 3],
    ]),
  ],
};

const rakhi: Motif = {
  id: 'rakhi',
  layers: [
    {
      paths: [
        { d: 'M-2 66C18 56 32 72 44 63M76 63C88 72 102 56 122 66', stroke: 'line', width: 2 },
        { d: circle(20, 62, 3) + circle(100, 62, 3), fill: 'light' },
      ],
    },
    {
      paths: [
        { d: dotRing(60, 63, 14, 29, 1.6), fill: 'light' },
        { d: ring(60, 63, 12, 11, 15, 0.22), stroke: 'line', fill: 'soft' },
        { d: ring(60, 63, 8, 5, 10, 0.34, 22.5), fill: 'light' },
        { d: circle(60, 63, 5), fill: 'line' },
        { d: circle(60, 63, 7.5), stroke: 'line' },
      ],
      motion: 'turn',
      origin: [60, 63],
    },
    ...SPARKLES(
      [
        [26, 30, 4],
        [96, 96, 3.5],
      ],
      0.5,
    ),
  ],
};

const kolam: Motif = {
  id: 'kolam',
  layers: [
    {
      paths: [
        { d: circle(60, 60, 8.4), stroke: 'line' },
        { d: circle(60, 60, 3), fill: 'light' },
        { d: ring(60, 60, 12, 9.6, 15.6, 0.18), stroke: 'line' },
        { d: ring(60, 60, 12, 27.6, 20.4, 0.16, 15), stroke: 'line' },
        { d: dotRing(60, 60, 12, 52.8, 1.9), fill: 'light' },
        { d: dotRing(60, 60, 12, 40, 1.2, 15), fill: 'line' },
      ],
      motion: 'turn',
      origin: [60, 60],
    },
  ],
};

function toranPaths(): { string: MotifPath[]; leaves: MotifLayer[] } {
  const from = [-4, 30] as const;
  const control = [60, 62] as const;
  const to = [124, 30] as const;
  const leaves: MotifLayer[] = [];
  const spots = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94];
  spots.forEach((t, index) => {
    const [x, y] = onCurve(from, control, to, t);
    const flower = index % 2 === 1;
    leaves.push({
      paths: flower
        ? [...marigold(x, y + 7, 5.2)]
        : [
            { d: hangingLeaf(x, y, 24, 6.5), fill: 'soft' },
            { d: hangingLeaf(x, y, 24, 6.5), stroke: 'line' },
            { d: `M${pt(x, y)}L${pt(x, y + 22)}`, stroke: 'line', opacity: 0.6 },
          ],
      motion: 'sway',
      origin: [x, y],
      delay: index * 0.45,
    });
  });
  return {
    string: [{ d: `M${pt(...from)}Q${pt(...control)} ${pt(...to)}`, stroke: 'line' }],
    leaves,
  };
}

const toranParts = toranPaths();

const toran: Motif = {
  id: 'toran',
  frame: [0, 22, 120, 62],
  layers: [
    { paths: toranParts.string },
    ...toranParts.leaves,
    ...SPARKLES(
      [
        [30, 96, 4],
        [90, 100, 3],
      ],
      0.3,
    ),
  ],
};

function bathukammaPaths(): MotifPath[] {
  // Tiers of flowers, alternately gold and a wash, as the real ones alternate.
  const tiers: { y: number; w: number; color: MotifPaint }[] = [
    { y: 94, w: 36, color: 'soft' },
    { y: 81, w: 29, color: 'light' },
    { y: 68, w: 22, color: 'soft' },
    { y: 55, w: 15.5, color: 'light' },
    { y: 43, w: 9.5, color: 'soft' },
  ];
  const paths: MotifPath[] = [];
  tiers.forEach(({ y, w, color }, index) => {
    const next = tiers[index + 1]?.w ?? 5;
    const topW = next + 3.5;
    const bumps = Math.max(3, Math.round(topW / 3.4));
    let top = '';
    for (let bump = 0; bump < bumps; bump += 1) {
      const x0 = 60 + topW - (bump * 2 * topW) / bumps;
      const x1 = 60 + topW - ((bump + 1) * 2 * topW) / bumps;
      top += `Q${pt((x0 + x1) / 2, y - 12)} ${pt(x1, y - 7)}`;
    }
    const shape =
      `M${pt(60 - w, y)}Q${pt(60, y + 6)} ${pt(60 + w, y)}` +
      `L${pt(60 + topW, y - 7)}${top}L${pt(60 - w, y)}Z`;
    paths.push({ d: shape, fill: color, opacity: color === 'light' ? 0.85 : undefined });
    paths.push({ d: shape, stroke: 'line', opacity: 0.8 });
  });
  paths.push({ d: 'M55.5 37L60 25L64.5 37Z', fill: 'light' });
  paths.push({ d: ellipse(60, 101, 44, 5), stroke: 'line' });
  return paths;
}

const bathukamma: Motif = {
  id: 'bathukamma',
  layers: [
    {
      paths: [{ d: circle(60, 62, 40), fill: 'light', opacity: 0.1 }],
      motion: 'pulse',
      origin: [60, 62],
      detail: true,
    },
    { paths: bathukammaPaths(), motion: 'float', origin: [60, 100] },
    ...[
      [22, 24, 'light', 0],
      [98, 30, 'line', 1.5],
      [16, 70, 'line', 3],
      [104, 76, 'light', 4.2],
    ].map(([x, y, color, delay]): MotifLayer => ({
      paths: [{ d: petal(x as number, y as number, 60, 0, 7, 0.5), fill: color as MotifPaint }],
      motion: 'fall',
      origin: [x as number, y as number],
      delay: delay as number,
      detail: true,
    })),
  ],
};

function rays(cx: number, cy: number, from: number, to: number, count: number, start: number) {
  let path = '';
  const span = 180 / (count - 1);
  for (let index = 0; index < count; index += 1) {
    const degrees = start + index * span;
    path += `M${pt(...polar(cx, cy, from, degrees))}L${pt(...polar(cx, cy, to, degrees))}`;
  }
  return path;
}

const sun: Motif = {
  id: 'sun',
  layers: [
    {
      paths: [{ d: rays(60, 74, 27, 39, 11, 180), stroke: 'light', width: 1.6 }],
      motion: 'pulse',
      origin: [60, 74],
    },
    {
      paths: [
        { d: 'M38 74A22 22 0 0 1 82 74Z', fill: 'light' },
        { d: 'M8 74H112', stroke: 'line' },
      ],
    },
    {
      paths: [
        {
          d: 'M16 84Q26 80 36 84T56 84T76 84T96 84M30 94Q40 90 50 94T70 94T90 94M42 104Q52 100 62 104T82 104',
          stroke: 'line',
          opacity: 0.75,
        },
      ],
      motion: 'wave',
      origin: [60, 94],
    },
    {
      paths: [...smallDiya(92, 92, 0.8), { d: flame(92, 90.5, 10, 2.8), fill: 'light' }],
      motion: 'float',
      origin: [92, 92],
      delay: 0.6,
      detail: true,
    },
  ],
};

function lantern(x: number, drop: number, s: number): MotifPath[] {
  const X = (dx: number) => r2(x + dx * s);
  const Y = (dy: number) => r2(drop + dy * s);
  const body =
    `M${X(-7)} ${Y(4)}L${X(7)} ${Y(4)}L${X(10)} ${Y(15)}L${X(6)} ${Y(27)}` +
    `L${X(-6)} ${Y(27)}L${X(-10)} ${Y(15)}Z`;
  return [
    { d: `M${pt(x, 0)}V${Y(0)}`, stroke: 'line', opacity: 0.7 },
    { d: `M${X(-5)} ${Y(4)}Q${X(0)} ${Y(-3)} ${X(5)} ${Y(4)}Z`, stroke: 'line', fill: 'soft' },
    { d: body, fill: 'light', opacity: 0.9 },
    { d: body, stroke: 'line' },
    { d: `M${X(0)} ${Y(4)}V${Y(27)}M${X(-10)} ${Y(15)}H${X(10)}`, stroke: 'line', opacity: 0.6 },
    {
      d: `M${X(-4)} ${Y(27)}L${X(0)} ${Y(33)}L${X(4)} ${Y(27)}M${X(0)} ${Y(33)}V${Y(39)}`,
      stroke: 'line',
    },
  ];
}

const crescent: Motif = {
  id: 'crescent',
  layers: [
    {
      paths: [{ d: circle(84, 38, 30), fill: 'light', opacity: 0.1 }],
      motion: 'pulse',
      origin: [84, 38],
      detail: true,
    },
    {
      paths: [
        { d: 'M81.75 16A22 22 0 1 0 103.05 44.4A18 18 0 0 1 81.75 16Z', fill: 'light' },
        { d: 'M81.75 16A22 22 0 1 0 103.05 44.4A18 18 0 0 1 81.75 16Z', stroke: 'line' },
      ],
    },
    {
      paths: [{ d: star(99, 25, 5, 6, 2.6), fill: 'light' }],
      motion: 'twinkle',
      origin: [99, 25],
    },
    { paths: lantern(24, 36, 1), motion: 'swing', origin: [24, 0], detail: true },
    { paths: lantern(48, 58, 0.82), motion: 'swing', origin: [48, 0], delay: 1.1, detail: true },
    ...SPARKLES(
      [
        [70, 88, 3.5],
        [100, 76, 2.6],
        [16, 100, 3],
      ],
      0.6,
    ),
  ],
};

function bulbs(
  from: readonly [number, number],
  control: readonly [number, number],
  to: readonly [number, number],
  count: number,
  start: number,
): MotifLayer[] {
  return Array.from({ length: count }, (_, index) => {
    const [x, y] = onCurve(from, control, to, (index + 0.5) / count);
    return {
      paths: [
        { d: `M${pt(x, y)}V${r2(y + 3)}`, stroke: 'line' },
        { d: ellipse(x, y + 7, 3, 4.4), fill: 'light' },
      ],
      motion: 'twinkle' as const,
      origin: [x, y + 7] as const,
      delay: start + index * 0.35,
    };
  });
}

const christmasStar: Motif = {
  id: 'star',
  layers: [
    {
      paths: [{ d: rays(60, 44, 30, 40, 9, 180) + rays(60, 44, 30, 36, 8, 191), stroke: 'light' }],
      motion: 'pulse',
      origin: [60, 44],
      detail: true,
    },
    {
      paths: [
        { d: star(60, 44, 5, 25, 10.5), fill: 'light' },
        { d: star(60, 44, 5, 25, 10.5), stroke: 'line' },
        { d: star(60, 44, 5, 10, 4.2), fill: 'line', opacity: 0.85 },
      ],
      motion: 'pulse',
      origin: [60, 44],
    },
    { paths: [{ d: 'M-2 84Q30 108 60 92Q90 76 122 98', stroke: 'line' }], detail: true },
    ...bulbs([-2, 84], [30, 108], [60, 92], 4, 0).map((layer) => ({ ...layer, detail: true })),
    ...bulbs([60, 92], [90, 76], [122, 98], 4, 1.4).map((layer) => ({ ...layer, detail: true })),
    ...SPARKLES([
      [22, 26, 4],
      [100, 20, 3.4],
      [96, 58, 2.6],
    ]),
  ],
};

const lily: Motif = {
  id: 'lily',
  layers: [
    {
      paths: [{ d: rays(60, 104, 60, 74, 9, 180), stroke: 'light', opacity: 0.8 }],
      motion: 'pulse',
      origin: [60, 104],
      detail: true,
    },
    {
      paths: [
        { d: 'M60 104C60 90 60 78 60 66', stroke: 'line' },
        { d: 'M60 104C50 96 36 92 26 94C36 84 52 88 60 100Z', stroke: 'line', fill: 'soft' },
        { d: 'M60 100C70 92 84 86 96 88C86 98 70 100 60 104Z', stroke: 'line', fill: 'soft' },
        { d: ring(60, 48, 6, 3, 24, 0.3, -90), fill: 'soft' },
        { d: ring(60, 48, 6, 3, 24, 0.3, -90), stroke: 'line' },
        {
          d: [0, 60, 120, 180, 240, 300]
            .map((degrees) => `M60 48L${pt(...polar(60, 48, 12, degrees - 60))}`)
            .join(''),
          stroke: 'line',
          opacity: 0.7,
        },
        { d: dotRing(60, 48, 6, 13, 1.7, -60), fill: 'light' },
      ],
      motion: 'sway',
      origin: [60, 104],
    },
    ...SPARKLES(
      [
        [22, 30, 3.6],
        [98, 26, 3],
      ],
      0.2,
    ),
  ],
};

const lights: Motif = {
  id: 'lights',
  layers: [
    {
      paths: [
        { d: 'M-2 16Q30 46 62 22Q92 0 122 28', stroke: 'line', opacity: 0.8 },
        { d: 'M-2 50Q34 78 62 54Q92 32 122 60', stroke: 'line', opacity: 0.8 },
      ],
      detail: true,
    },
    ...[
      [[-2, 16] as const, [30, 46] as const, [62, 22] as const, 0],
      [[62, 22] as const, [92, 0] as const, [122, 28] as const, 0.5],
      [[-2, 50] as const, [34, 78] as const, [62, 54] as const, 1],
      [[62, 54] as const, [92, 32] as const, [122, 60] as const, 1.5],
    ].flatMap(([from, control, to, start]) =>
      Array.from({ length: 5 }, (_, index): MotifLayer => {
        const [x, y] = onCurve(
          from as readonly [number, number],
          control as readonly [number, number],
          to as readonly [number, number],
          (index + 0.5) / 5,
        );
        return {
          paths: [{ d: circle(x, y + 2.5, 2.2), fill: 'light' }],
          motion: 'twinkle',
          origin: [x, y + 2.5],
          delay: (start as number) + index * 0.4,
          detail: true,
        };
      }),
    ),
    { paths: [30, 60, 90].flatMap((x) => smallDiya(x, 100, 1.35)) },
    ...[30, 60, 90].map((x, index): MotifLayer => ({
      paths: [{ d: flame(x, 98, 19, 4.8), fill: 'light' }],
      motion: 'flicker',
      origin: [x, 98],
      delay: index * 0.3,
    })),
  ],
  frame: [14, 70, 92, 42],
};

const lotus: Motif = {
  id: 'lotus',
  layers: [
    {
      paths: [{ d: circle(60, 54, 34), fill: 'light', opacity: 0.12 }],
      motion: 'pulse',
      origin: [60, 54],
      detail: true,
    },
    {
      paths: [
        { d: 'M56 80C42 79 28 70 20 58C36 55 50 64 56 80Z', stroke: 'line', fill: 'soft' },
        { d: 'M64 80C78 79 92 70 100 58C84 55 70 64 64 80Z', stroke: 'line', fill: 'soft' },
        { d: 'M58 80C44 70 38 54 41 40C53 47 60 62 58 80Z', stroke: 'line', fill: 'soft' },
        { d: 'M62 80C76 70 82 54 79 40C67 47 60 62 62 80Z', stroke: 'line', fill: 'soft' },
        { d: 'M60 30C70 43 71 64 60 80C49 64 50 43 60 30Z', stroke: 'line', fill: 'light' },
        { d: 'M34 82Q60 90 86 82', stroke: 'line' },
      ],
    },
    {
      paths: [
        {
          d: 'M18 94Q28 90 38 94T58 94T78 94T98 94M30 103Q40 99 50 103T70 103T90 103',
          stroke: 'line',
          opacity: 0.7,
        },
      ],
      motion: 'wave',
      origin: [60, 98],
    },
  ],
};

function burst(cx: number, cy: number, count: number, radius: number, color: MotifPaint) {
  let lines = '';
  let dots = '';
  for (let index = 0; index < count; index += 1) {
    const degrees = (index * 360) / count;
    lines += `M${pt(...polar(cx, cy, radius * 0.28, degrees))}L${pt(...polar(cx, cy, radius * 0.82, degrees))}`;
    dots += circle(...polar(cx, cy, radius, degrees), radius * 0.07);
  }
  return [
    { d: lines, stroke: color, width: 1.4 },
    { d: dots, fill: color },
  ] satisfies MotifPath[];
}

const fireworks: Motif = {
  id: 'fireworks',
  layers: [
    { paths: burst(42, 42, 14, 26, 'light'), motion: 'bloom', origin: [42, 42] },
    {
      paths: burst(88, 30, 11, 18, 'line'),
      motion: 'bloom',
      origin: [88, 30],
      delay: 1.1,
    },
    {
      paths: burst(80, 78, 16, 27, 'line'),
      motion: 'bloom',
      origin: [80, 78],
      delay: 2.2,
    },
    {
      paths: [{ d: 'M42 118Q40 90 42 72M80 118Q82 110 80 108', stroke: 'line', opacity: 0.5 }],
      detail: true,
    },
    ...SPARKLES([
      [18, 88, 3.5],
      [104, 104, 3],
      [110, 52, 2.6],
    ]),
  ],
};

function band(offset: number, height: number, color: MotifPaint): MotifPath {
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let x = -8; x <= 128; x += 17) {
    const y = 58 + offset + Math.sin((x / 120) * Math.PI * 2) * 10 - x * 0.12;
    top.push([x, y]);
    bottom.push([x, y + height]);
  }
  const upper = smooth(top, false);
  const lower = smooth([...bottom].reverse(), false).replace(/^M/, 'L');
  return { d: `${upper}${lower}Z`, fill: color };
}

const tricolour: Motif = {
  id: 'tricolour',
  layers: [
    {
      paths: [band(-14, 10, '#ff9933'), band(-4, 10, '#ffffff'), band(6, 10, '#138808')],
      motion: 'wave',
      origin: [60, 60],
    },
    ...SPARKLES(
      [
        [24, 26, 4],
        [98, 90, 3.6],
        [96, 22, 2.8],
      ],
      0.3,
    ),
  ],
};

const charkha: Motif = {
  id: 'charkha',
  layers: [
    {
      paths: [
        { d: 'M8 104H112M46 58L32 104M46 58L60 104', stroke: 'line' },
        { d: 'M84 92H108V104H84Z', stroke: 'line', fill: 'soft' },
        { d: 'M90 88L114 82', stroke: 'line' },
        { d: 'M46 26L114 82', stroke: 'line', opacity: 0.45 },
      ],
    },
    {
      paths: [
        { d: circle(46, 58, 32), stroke: 'line' },
        { d: circle(46, 58, 28.5), stroke: 'line', opacity: 0.5 },
        { d: circle(46, 58, 4), fill: 'light' },
        {
          d: Array.from({ length: 8 }, (_, index) => {
            const degrees = index * 45;
            return `M${pt(...polar(46, 58, 4, degrees))}L${pt(...polar(46, 58, 28.5, degrees))}`;
          }).join(''),
          stroke: 'line',
        },
      ],
      motion: 'turn',
      origin: [46, 58],
    },
  ],
};

const trophy: Motif = {
  id: 'trophy',
  layers: [
    {
      paths: [{ d: circle(60, 50, 34), fill: 'light', opacity: 0.1 }],
      motion: 'pulse',
      origin: [60, 50],
      detail: true,
    },
    {
      paths: [
        {
          d: 'M38 22H82L80 44C78 60 70 68 60 68C50 68 42 60 40 44Z',
          stroke: 'line',
          fill: 'soft',
        },
        { d: 'M39 28C24 28 24 52 42 53M81 28C96 28 96 52 78 53', stroke: 'line' },
        { d: 'M55 68V80M65 68V80', stroke: 'line' },
        { d: 'M46 80H74L78 92H42Z', stroke: 'line', fill: 'soft' },
        { d: 'M36 92H84V101H36Z', stroke: 'line' },
        { d: star(60, 40, 5, 8, 3.4), fill: 'light' },
      ],
    },
    ...SPARKLES([
      [20, 22, 4.2],
      [100, 18, 3.4],
      [104, 58, 2.6],
    ]),
  ],
};

function note(x: number, y: number, stem: number) {
  return {
    head: ellipse(x, y, 5.8, 4.2, -22),
    stem: `M${pt(x + 5.2, y - 1.6)}V${r2(y - stem)}`,
  };
}

const musicNotes = (() => {
  const a = note(30, 60, 30);
  const b = note(50, 54, 30);
  const c = note(84, 44, 32);
  return [
    {
      paths: [
        { d: a.head + b.head, fill: 'line' },
        { d: a.stem + b.stem, stroke: 'line' },
        { d: `M35.2 30L55.2 24V29L35.2 35Z`, fill: 'line' },
      ],
      motion: 'float',
      origin: [42, 44],
    },
    {
      paths: [
        { d: c.head, fill: 'line' },
        { d: c.stem, stroke: 'line' },
        { d: 'M89.2 12C94 16 100 18 98 28', stroke: 'line' },
      ],
      motion: 'float',
      origin: [86, 30],
      delay: 1.2,
    },
  ] satisfies MotifLayer[];
})();

const music: Motif = {
  id: 'music',
  layers: [
    {
      paths: [
        {
          d: [0, 5, 10, 15, 20]
            .map((dy) => `M-4 ${76 + dy}C30 ${58 + dy} 70 ${98 + dy} 124 ${70 + dy}`)
            .join(''),
          stroke: 'line',
          opacity: 0.45,
        },
      ],
      motion: 'wave',
      origin: [60, 86],
      detail: true,
    },
    ...musicNotes,
    ...SPARKLES(
      [
        [104, 70, 3.6],
        [16, 26, 3],
      ],
      0.4,
    ),
  ],
};

function balloon(x: number, y: number, rx: number, ry: number, color: MotifPaint): MotifPath[] {
  return [
    {
      d: `M${pt(x, y + ry + 2)}C${pt(x - 5, y + ry + 16)} ${pt(x + 5, y + ry + 26)} ${pt(x - 2, y + ry + 42)}`,
      stroke: 'line',
      opacity: 0.7,
    },
    { d: ellipse(x, y, rx, ry), stroke: 'line', fill: color },
    {
      d: `M${pt(x - 3, y + ry + 3)}L${pt(x, y + ry - 1)}L${pt(x + 3, y + ry + 3)}Z`,
      stroke: 'line',
      fill: color,
    },
    {
      d: ellipse(x - rx * 0.4, y - ry * 0.4, rx * 0.22, ry * 0.3, -30),
      fill: 'line',
      opacity: 0.45,
    },
  ];
}

const balloons: Motif = {
  id: 'balloons',
  layers: [
    { paths: balloon(42, 44, 15, 18, 'soft'), motion: 'float', origin: [42, 44] },
    {
      paths: balloon(76, 34, 13.5, 16.5, 'light'),
      motion: 'float',
      origin: [76, 34],
      delay: 1.1,
    },
    {
      paths: balloon(62, 62, 12.5, 15.5, 'soft'),
      motion: 'float',
      origin: [62, 62],
      delay: 2.2,
    },
    ...SPARKLES(
      [
        [100, 70, 4],
        [18, 86, 3.2],
      ],
      0.3,
    ),
  ],
};

function heartShape(cx: number, cy: number, s: number) {
  const X = (dx: number) => r2(cx + dx * s);
  const Y = (dy: number) => r2(cy + dy * s);
  return (
    `M${X(0)} ${Y(28)}C${X(-30)} ${Y(8)} ${X(-38)} ${Y(-10)} ${X(-26)} ${Y(-22)}` +
    `C${X(-16)} ${Y(-32)} ${X(-4)} ${Y(-28)} ${X(0)} ${Y(-18)}` +
    `C${X(4)} ${Y(-28)} ${X(16)} ${Y(-32)} ${X(26)} ${Y(-22)}` +
    `C${X(38)} ${Y(-10)} ${X(30)} ${Y(8)} ${X(0)} ${Y(28)}Z`
  );
}

const heart: Motif = {
  id: 'heart',
  layers: [
    {
      paths: [
        { d: heartShape(60, 62, 1), stroke: 'line', fill: 'soft' },
        { d: heartShape(60, 60, 0.46), fill: 'light' },
      ],
      motion: 'pulse',
      origin: [60, 62],
    },
    ...[
      [24, 40, 0.24, 0],
      [96, 30, 0.2, 1.3],
      [100, 86, 0.16, 2.4],
    ].map(([x, y, s, delay]): MotifLayer => ({
      paths: [{ d: heartShape(x!, y!, s!), fill: 'line', opacity: 0.8 }],
      motion: 'rise',
      origin: [x!, y!],
      delay,
      detail: true,
    })),
  ],
};

const leaf: Motif = {
  id: 'leaf',
  layers: [
    {
      paths: [
        { d: 'M60 102C60 88 58 76 60 60', stroke: 'line' },
        { d: 'M60 80C45 82 34 72 31 56C46 55 58 64 60 80Z', stroke: 'line', fill: 'soft' },
        { d: 'M60 80C52 72 44 64 36 60', stroke: 'line', opacity: 0.6 },
        { d: 'M60 68C73 68 86 57 89 41C74 41 62 51 60 68Z', stroke: 'line', fill: 'soft' },
        { d: 'M60 68C68 60 76 52 84 46', stroke: 'line', opacity: 0.6 },
        { d: 'M60 60C54 52 54 42 60 34C66 42 66 52 60 60Z', stroke: 'line', fill: 'light' },
      ],
      motion: 'sway',
      origin: [60, 102],
    },
    { paths: [{ d: 'M32 102Q60 92 88 102', stroke: 'line' }] },
    ...[
      [22, 28, 0],
      [98, 72, 2],
    ].map(([x, y, delay]): MotifLayer => ({
      paths: [
        {
          d: `M${pt(x!, y!)}C${pt(x! + 6, y! - 2)} ${pt(x! + 9, y! + 4)} ${pt(x! + 8, y! + 8)}C${pt(x! + 2, y! + 8)} ${pt(x! - 2, y! + 4)} ${pt(x!, y!)}Z`,
          fill: 'soft',
          stroke: 'line',
        },
      ],
      motion: 'fall',
      origin: [x! + 4, y! + 4],
      delay,
      detail: true,
    })),
  ],
};

const thali: Motif = {
  id: 'thali',
  layers: [
    {
      paths: [
        { d: circle(60, 64, 44), stroke: 'line', fill: 'soft' },
        { d: circle(60, 64, 39), stroke: 'line', opacity: 0.45 },
        { d: circle(42, 44, 10) + circle(74, 40, 9) + circle(88, 64, 9.5), stroke: 'line' },
        { d: circle(42, 44, 7.6), fill: 'light', opacity: 0.9 },
        { d: circle(74, 40, 6.8) + circle(88, 64, 7.2), fill: 'soft' },
        { d: circle(50, 76, 15), stroke: 'line', fill: 'light', opacity: 0.9 },
        {
          d: circle(45, 72, 1) + circle(54, 70, 1) + circle(50, 80, 1) + circle(57, 79, 1),
          fill: 'line',
        },
        { d: 'M70 82C70 74 88 73 88 83C88 89 70 89 70 82Z', fill: 'soft', stroke: 'line' },
      ],
    },
    ...[
      [42, 0],
      [74, 1.2],
    ].map(([x, delay]): MotifLayer => ({
      paths: [
        {
          d: `M${pt(x!, 30)}C${pt(x! - 4, 24)} ${pt(x! + 4, 20)} ${pt(x!, 14)}`,
          stroke: 'line',
          opacity: 0.7,
        },
      ],
      motion: 'rise',
      origin: [x!, 22],
      delay,
      detail: true,
    })),
  ],
};

const dots: Motif = {
  id: 'dots',
  layers: [
    {
      paths: [
        {
          d: [24, 42, 60, 78, 96]
            .flatMap((x) => [24, 42, 60, 78, 96].map((y) => circle(x, y, 1.9)))
            .join(''),
          fill: 'line',
        },
        {
          d: smooth([
            [60, 14],
            [74, 33],
            [87, 33],
            [87, 46],
            [106, 60],
            [87, 74],
            [87, 87],
            [74, 87],
            [60, 106],
            [46, 87],
            [33, 87],
            [33, 74],
            [14, 60],
            [33, 46],
            [33, 33],
            [46, 33],
          ]),
          stroke: 'line',
        },
        { d: circle(60, 60, 10), stroke: 'light' },
      ],
    },
  ],
};

const confetti: Motif = {
  id: 'confetti',
  layers: [
    ...(
      [
        [18, 16, 'light', 0, 20],
        [44, 30, 'line', 0.8, -30],
        [74, 12, 'light', 1.6, 45],
        [98, 34, 'line', 2.4, -15],
        [30, 62, 'light', 3.1, 60],
        [62, 50, 'line', 3.8, -40],
        [90, 74, 'light', 4.5, 25],
        [52, 88, 'line', 5.2, -60],
      ] as const
    ).map(([x, y, color, delay, turn]): MotifLayer => ({
      paths: [
        {
          d: ellipse(x, y, 5, 2.4, turn),
          fill: color,
        },
      ],
      motion: 'fall',
      origin: [x, y],
      delay,
    })),
    {
      paths: [
        {
          d: 'M16 96C22 88 28 104 34 96S46 104 52 96M70 102C76 94 82 110 88 102S100 110 106 102',
          stroke: 'line',
          opacity: 0.7,
        },
      ],
      detail: true,
    },
  ],
};

export const MOTIFS: Readonly<Record<MotifId, Motif>> = {
  none: { id: 'none', layers: [] },
  dots,
  diya,
  gulal,
  garland,
  modak,
  pookalam,
  pot,
  kite,
  bonfire,
  sheaf,
  feather,
  rakhi,
  kolam,
  toran,
  bathukamma,
  sun,
  crescent,
  star: christmasStar,
  lily,
  lights,
  lotus,
  fireworks,
  tricolour,
  charkha,
  trophy,
  music,
  balloons,
  heart,
  leaf,
  thali,
  confetti,
};

/** The layers to draw: everything on a hero, the essentials on a small tile. */
export function motifLayers(id: MotifId, compact = false): readonly MotifLayer[] {
  const layers = MOTIFS[id].layers;
  return compact ? layers.filter((layer) => !layer.detail) : layers;
}

/** The SVG viewBox to draw a motif in: the whole canvas, or a tile's frame. */
export function motifViewBox(id: MotifId, compact = false): string {
  const frame = compact ? MOTIFS[id].frame : undefined;
  return (frame ?? [0, 0, 120, 120]).join(' ');
}
