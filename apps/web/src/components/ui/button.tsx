import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'festive' | 'inverse' | 'glass';
type Size = 'sm' | 'md' | 'lg';

/**
 * Primary is ink, not colour: with a festival's colour on every button there
 * would be none left for the festival. `festive` is the one that wears it —
 * the Contribute button in the bar, say. `inverse` and `glass` are for a
 * festival banner, where ink on a dark gradient would vanish.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink/88 shadow-sm',
  secondary:
    'bg-surface-raised text-ink border border-border-base hover:bg-surface-sunken shadow-sm',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
  festive: 'bg-accent text-accent-ink hover:opacity-90 shadow-sm',
  inverse: 'bg-white text-[oklch(0.205_0.012_70)] hover:bg-white/90 shadow-sm',
  glass: 'border border-white/25 bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm',
};

/**
 * Heights are for a mouse; a finger gets 44px whatever the size says.
 *
 * `sm` is 32px and `md` is 40px, against the 44px Apple asks for and the 48dp
 * Android does — fine for a cursor, which lands where you point it, and not for
 * a thumb, which is about 44px wide and lands near it. Eighty-eight of the
 * app's buttons are `sm`, including Confirm and Decline on a payment.
 *
 * `pointer: coarse` rather than a width breakpoint, because the question is
 * what is doing the pointing, not how wide the screen is: a tablet in landscape
 * is a touch device at desktop width, and a small desktop window is still a
 * mouse. A desktop keeps its density.
 */
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 pointer-coarse:h-11',
  md: 'h-10 px-4 text-sm gap-2 pointer-coarse:h-11',
  lg: 'h-12 px-6 text-base gap-2',
};

const base =
  'inline-flex items-center justify-center rounded-xl font-medium whitespace-nowrap ' +
  'transition-[opacity,background-color,transform] duration-150 active:scale-[0.97] ' +
  'disabled:pointer-events-none disabled:opacity-50';

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
