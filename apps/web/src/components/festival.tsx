import type { CSSProperties, ReactNode } from 'react';
import type { Festival } from '@samudaya/core';
import { cn } from '@/lib/utils';

/**
 * Hands a subtree the festival's colours by re-pointing the same tokens the
 * rest of the app already reads. Nothing below needs to know which festival it
 * is in — `text-accent` simply means marigold on a Deepavali page and
 * vermilion on a Dasara one.
 *
 * `light-dark()` carries both themes in one value, so this works without a
 * second set of rules under the dark-mode media query.
 */
export function festivalVars(festival: Festival): CSSProperties {
  return {
    '--accent': `light-dark(${festival.accent[0]}, ${festival.accent[1]})`,
    '--ribbon': `light-dark(${festival.ribbon[0]}, ${festival.ribbon[1]})`,
    '--festival-wash': `light-dark(${festival.wash[0]}, ${festival.wash[1]})`,
  } as CSSProperties;
}

/**
 * A kolam drawn from the festival's petal count: a centre, a ring of petals,
 * an outer ring offset by half a step, and the dots the pattern is laid out
 * around. Decorative — it carries no meaning and is hidden from screen readers.
 */
export function Rangoli({
  petals,
  className,
  strokeWidth = 1.5,
  mono = false,
}: {
  petals: number;
  className?: string;
  strokeWidth?: number;
  /**
   * Draw the whole kolam in `currentColor` instead of the two festival
   * colours — for placing it on top of the festival gradient, where the
   * accent would disappear into the background it is made of.
   */
  mono?: boolean;
}) {
  const step = (Math.PI * 2) / petals;
  const petal = (index: number, radius: number, length: number, width: number) => {
    const angle = index * step;
    const tipX = 50 + Math.cos(angle) * (radius + length);
    const tipY = 50 + Math.sin(angle) * (radius + length);
    const baseX = 50 + Math.cos(angle) * radius;
    const baseY = 50 + Math.sin(angle) * radius;
    const left = angle - width;
    const right = angle + width;
    const midRadius = radius + length * 0.55;
    return [
      `M ${baseX.toFixed(2)} ${baseY.toFixed(2)}`,
      `Q ${(50 + Math.cos(left) * midRadius).toFixed(2)} ${(50 + Math.sin(left) * midRadius).toFixed(2)}`,
      `${tipX.toFixed(2)} ${tipY.toFixed(2)}`,
      `Q ${(50 + Math.cos(right) * midRadius).toFixed(2)} ${(50 + Math.sin(right) * midRadius).toFixed(2)}`,
      `${baseX.toFixed(2)} ${baseY.toFixed(2)}`,
      'Z',
    ].join(' ');
  };

  const ring = Array.from({ length: petals }, (_, index) => index);
  const strokeAccent = mono ? 'stroke-current' : 'stroke-accent';
  const fillAccent = mono ? 'fill-current' : 'fill-accent';
  const strokeRibbon = mono ? 'stroke-current' : 'stroke-ribbon';
  const fillRibbon = mono ? 'fill-current' : 'fill-ribbon';

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      strokeWidth={strokeWidth}
    >
      <circle cx="50" cy="50" r="7" className={strokeAccent} />
      <circle cx="50" cy="50" r="2.5" className={fillAccent} stroke="none" />
      {ring.map((index) => (
        <path
          key={`inner-${index}`}
          d={petal(index, 8, 13, step * 0.34)}
          className={strokeAccent}
        />
      ))}
      {ring.map((index) => (
        <path
          key={`outer-${index}`}
          d={petal(index + 0.5, 23, 17, step * 0.3)}
          className={strokeRibbon}
        />
      ))}
      {ring.map((index) => {
        const angle = index * step;
        return (
          <circle
            key={`dot-${index}`}
            cx={(50 + Math.cos(angle) * 44).toFixed(2)}
            cy={(50 + Math.sin(angle) * 44).toFixed(2)}
            r="1.6"
            className={fillRibbon}
            stroke="none"
          />
        );
      })}
    </svg>
  );
}

/**
 * The toran over a doorway: mango leaves on a string, with a marigold between
 * them. One SVG tile, repeated across whatever it is put on top of.
 */
export function Toran({
  className,
  patternId = 'toran',
}: {
  className?: string;
  patternId?: string;
}) {
  return (
    <svg className={className} aria-hidden="true" focusable="false" width="100%" height="14">
      <defs>
        {/* The colours come from this pattern's own classes, so two torans in
            different festivals need two ids — otherwise the second borrows the
            first one's palette. */}
        <pattern id={patternId} width="48" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M0 2 Q 12 6 24 2 Q 36 6 48 2"
            className="stroke-ribbon"
            fill="none"
            strokeWidth="1"
          />
          <path d="M8 3 Q 5 8 8 12 Q 11 8 8 3 Z" className="fill-accent" />
          <path d="M40 3 Q 37 8 40 12 Q 43 8 40 3 Z" className="fill-accent" />
          <circle cx="24" cy="6.5" r="3" className="fill-ribbon" />
          <circle cx="24" cy="6.5" r="1.2" className="fill-accent" />
        </pattern>
      </defs>
      <rect width="100%" height="14" fill={`url(#${patternId})`} />
    </svg>
  );
}

/**
 * A page header dressed for its festival: the wash behind it, the toran along
 * the top, and the kolam bleeding off the right-hand edge.
 */
export function FestivalHeader({
  festival,
  title,
  description,
  action,
  className,
}: {
  festival: Festival;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={festivalVars(festival)}
      className={cn(
        'border-border-base relative isolate overflow-hidden border-b',
        'bg-[var(--festival-wash)]',
        className,
      )}
    >
      <Toran patternId={`toran-${festival.id}`} className="absolute inset-x-0 top-0 opacity-70" />
      <Rangoli
        petals={festival.petals}
        className="pointer-events-none absolute -top-10 -right-12 size-52 opacity-[0.13] sm:-right-6 sm:size-60"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3 px-4 pt-7 pb-5 md:px-6">
        <div className="min-w-0">
          <h1 className="text-ink text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-ink-muted mt-1 text-sm">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
