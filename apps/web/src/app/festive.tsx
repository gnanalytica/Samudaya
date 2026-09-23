import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * The front page's decorations. Everything here is drawn in the festival's own
 * tokens — `--accent`, `--ribbon`, `--festival-wash` — so the same garland is
 * marigold for Deepavali and vermilion for Dasara without knowing which it is.
 * All of it is decoration: hidden from screen readers, and never under text
 * that has to be read.
 */

/**
 * A marigold garland along the top of a doorway: a swag of flowers, a strand
 * hanging from the bottom of each swag, and mango leaves where the swags meet.
 *
 * One tile of it, repeated to whatever width it is given — the same trick as
 * the toran in components/festival.tsx, at a size meant for a front page.
 * `id` names the tile, and has to be different for each garland on a page.
 */
export function Garland({ id, className }: { id: string; className?: string }) {
  // Seven flowers along each swag. The curve's control point is centred, so a
  // flower's x is simply its fraction of the width.
  const swag = Array.from({ length: 7 }, (_, step) => {
    const t = step / 6;
    return { x: 60 * t, y: 5 + 28 * t * (1 - t), tone: step % 2 };
  });

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="100%"
      height="46"
      className={cn('block', className)}
      style={
        {
          // Two flowers, the festival's own colour and a marigold yellow, the
          // way a real garland mixes two; and a deeper heart for each. The
          // yellow is fixed rather than mixed from the accent, or Christmas
          // and Eid, whose accents are green, get a garland of green flowers.
          '--marigold': 'var(--accent)',
          '--marigold-gold': 'oklch(0.82 0.16 80)',
          '--marigold-heart': 'color-mix(in oklch, var(--accent), oklch(0.36 0.12 35) 40%)',
          '--leaf': 'oklch(0.6 0.13 145)',
        } as CSSProperties
      }
    >
      <defs>
        <pattern id={id} width="60" height="46" patternUnits="userSpaceOnUse">
          {/* Leaves at both ends: a tile's edge cuts them in half, and the
              next tile draws the other half. */}
          {[0, 60].map((x) => (
            <g key={x}>
              <Leaf x={x} y={6} angle={-24} length={13} />
              <Leaf x={x} y={6} angle={24} length={13} />
            </g>
          ))}
          <path d="M30 12 V 31" style={{ stroke: 'var(--ribbon)' }} strokeWidth="0.8" />
          <Marigold x={30} y={19.6} r={3.7} gold />
          <Marigold x={30} y={27} r={3.4} />
          <Leaf x={30} y={29.5} angle={0} length={15} />
          <path
            d="M0 5 Q 30 19 60 5"
            fill="none"
            style={{ stroke: 'var(--ribbon)' }}
            strokeWidth="1.2"
          />
          {swag.map((flower) => (
            <Marigold key={flower.x} x={flower.x} y={flower.y} r={4.7} gold={!!flower.tone} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="46" fill={`url(#${id})`} />
    </svg>
  );
}

function Marigold({ x, y, r, gold = false }: { x: number; y: number; r: number; gold?: boolean }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        style={{ fill: gold ? 'var(--marigold-gold)' : 'var(--marigold)' }}
      />
      {/* Notches in the background colour read as ruffled petals at this size. */}
      <circle
        cx={x}
        cy={y}
        r={r * 0.72}
        fill="none"
        style={{ stroke: 'var(--festival-wash)' }}
        strokeWidth="0.7"
        strokeDasharray="0.8 1.4"
        opacity="0.75"
      />
      <circle cx={x} cy={y} r={r * 0.34} style={{ fill: 'var(--marigold-heart)' }} />
    </g>
  );
}

function Leaf({ x, y, angle, length }: { x: number; y: number; angle: number; length: number }) {
  const width = length * 0.3;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M0 0 C ${width} ${length * 0.3}, ${width} ${length * 0.72}, 0 ${length} C ${-width} ${length * 0.72}, ${-width} ${length * 0.3}, 0 0 Z`}
        style={{ fill: 'var(--leaf)' }}
      />
      <path
        d={`M0 1.2 V ${length - 1.8}`}
        style={{ stroke: 'var(--festival-wash)' }}
        strokeWidth="0.5"
        opacity="0.55"
      />
    </g>
  );
}

/**
 * Sparkles, scattered where the text is not: the right-hand side on a wide
 * screen, and only the edges on a phone, where the text is the whole width.
 */
const SPARKS: {
  top: string;
  left: string;
  size: number;
  delay: string;
  tone: 'accent' | 'ribbon';
  /** Shown on a wide screen only. */
  wide?: boolean;
}[] = [
  { top: '10%', left: '93%', size: 14, delay: '0s', tone: 'accent' },
  { top: '30%', left: '60%', size: 12, delay: '1.1s', tone: 'ribbon', wide: true },
  { top: '16%', left: '74%', size: 20, delay: '2.3s', tone: 'accent', wide: true },
  { top: '52%', left: '88%', size: 10, delay: '0.6s', tone: 'ribbon', wide: true },
  { top: '70%', left: '68%', size: 16, delay: '1.8s', tone: 'accent', wide: true },
  { top: '84%', left: '95%', size: 12, delay: '2.9s', tone: 'ribbon' },
  { top: '6%', left: '46%', size: 9, delay: '1.4s', tone: 'ribbon', wide: true },
];

export function Sparkles({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      {SPARKS.map((spark) => (
        <svg
          key={`${spark.top}-${spark.left}`}
          viewBox="0 0 24 24"
          width={spark.size}
          height={spark.size}
          className={cn(
            'motion-safe:animate-twinkle absolute',
            spark.tone === 'accent' ? 'fill-accent' : 'fill-ribbon',
            spark.wide && 'hidden sm:block',
          )}
          style={{ top: spark.top, left: spark.left, animationDelay: spark.delay }}
        >
          <path d="M12 0C12.7 7.3 16.7 11.3 24 12 16.7 12.7 12.7 16.7 12 24 11.3 16.7 7.3 12.7 0 12 7.3 11.3 11.3 7.3 12 0Z" />
        </svg>
      ))}
    </div>
  );
}
