import type { ReactNode } from 'react';
import type { Enums } from '@samudaya/supabase';
import { EVENT_STATUS_LABEL, EXPENSE_STATUS_LABEL, TASK_STATUS_LABEL } from '@samudaya/core';
import { cn } from '@/lib/utils';
import { Badge, type Tone } from './ui/badge';

const EVENT_TONES: Record<Enums<'event_status'>, Tone> = {
  proposed: 'warning',
  draft: 'neutral',
  published: 'brand',
  completed: 'success',
  cancelled: 'danger',
};

const TASK_TONES: Record<Enums<'task_status'>, Tone> = {
  todo: 'danger',
  in_progress: 'warning',
  done: 'success',
  blocked: 'neutral',
};

const EXPENSE_TONES: Record<Enums<'expense_status'>, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'info',
};

const PAYMENT: Record<Enums<'contribution_status'>, { tone: Tone; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting for confirmation' },
  succeeded: { tone: 'success', label: 'Confirmed' },
  failed: { tone: 'danger', label: 'Not confirmed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
};

/** Where a payment stands: reported payments count only once staff confirm them. */
export const PaymentStatusBadge = ({ status }: { status: Enums<'contribution_status'> }) => (
  <Badge tone={PAYMENT[status].tone}>{PAYMENT[status].label}</Badge>
);

export const EventStatusBadge = ({ status }: { status: Enums<'event_status'> }) => (
  <Badge tone={EVENT_TONES[status]}>{EVENT_STATUS_LABEL[status]}</Badge>
);

export const TaskStatusBadge = ({ status }: { status: Enums<'task_status'> }) => (
  <Badge tone={TASK_TONES[status]}>{TASK_STATUS_LABEL[status]}</Badge>
);

export const ExpenseStatusBadge = ({ status }: { status: Enums<'expense_status'> }) => (
  <Badge tone={EXPENSE_TONES[status]}>{EXPENSE_STATUS_LABEL[status]}</Badge>
);

/** The readiness figure that headlines every event card. */
export function ReadinessBar({ percent }: { percent: number }) {
  return (
    <div
      className="bg-surface-sunken h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Event readiness"
    >
      <div
        className="bg-accent h-full rounded-full transition-[width]"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/** Fund progress. Deliberately a different colour from readiness. */
/**
 * Money raised, and — optionally — money on its way behind it.
 *
 * The second segment is deliberately the same hue at lower opacity rather than
 * a colour of its own: it is the same money one step earlier, not a different
 * kind of thing, and a resident who has just paid should be able to find their
 * own contribution on the bar without being told the fund is further along
 * than it is. `aria-valuenow` stays the confirmed figure for the same reason.
 */
export function FundBar({
  percent,
  pendingPercent = 0,
  carriedPercent = 0,
}: {
  percent: number;
  /** Reported and not yet confirmed. Clamped to whatever the bar has left. */
  pendingPercent?: number;
  /** Carried across from another event or the society balance. */
  carriedPercent?: number;
}) {
  const carried = Math.min(100, Math.max(0, carriedPercent));
  const confirmed = Math.min(100 - carried, Math.max(0, percent));
  const pending = Math.min(100 - carried - confirmed, Math.max(0, pendingPercent));
  return (
    <div
      className="bg-surface-sunken flex h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={carried + confirmed}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Fund progress"
      aria-valuetext={[
        carried > 0 ? `${carried}% carried forward` : null,
        `${confirmed}% confirmed`,
        pending > 0 ? `${pending}% waiting to be confirmed` : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {/* Carried money first: it is the most settled thing on the bar, already
          in the society's account and already decided. */}
      {carried > 0 ? (
        <div className="bg-accent h-full transition-[width]" style={{ width: `${carried}%` }} />
      ) : null}
      <div className="bg-success h-full transition-[width]" style={{ width: `${confirmed}%` }} />
      {pending > 0 ? (
        <div className="bg-success/40 h-full transition-[width]" style={{ width: `${pending}%` }} />
      ) : null}
    </div>
  );
}

/**
 * The row of three stats that sits above a page.
 *
 * Two across on a phone with the third spanning the row, three across from
 * `sm`. Three across on a phone does not fit and never did: a third of a 360px
 * screen leaves about 77px of text space, and a full rupee amount needs 97px
 * at ₹1,25,000 and 128px at a crore. A digit string has no space or hyphen for
 * the browser to wrap at, so the number ran past its tile and took the whole
 * page sideways with it — every page carrying these tiles scrolled
 * horizontally at 360, 390 and 414px.
 *
 * Callers pass their own gap or border through `className`; twMerge lets those
 * win over the defaults here.
 */
export function StatTiles({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3',
        '[&>*:nth-child(3)]:col-span-2 sm:[&>*:nth-child(3)]:col-span-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className="border-border-base bg-surface-raised rounded-xl border px-3 py-3 text-center">
      <div
        className={cn(
          // A notch smaller on a phone, where the tile is narrower than the
          // screen it sits on. `break-words` is the backstop: a number too long
          // even for two-up wraps inside its tile instead of pushing the page.
          'text-base font-semibold tracking-tight break-words tabular-nums sm:text-lg',
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="text-ink-subtle mt-0.5 text-[11px] font-medium tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}
