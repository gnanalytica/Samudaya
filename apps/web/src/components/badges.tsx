import type { Enums } from '@samudaya/supabase';
import { EVENT_STATUS_LABEL, EXPENSE_STATUS_LABEL, TASK_STATUS_LABEL } from '@samudaya/core';
import { Badge, type Tone } from './ui/badge';

const EVENT_TONES: Record<Enums<'event_status'>, Tone> = {
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
export function FundBar({ percent }: { percent: number }) {
  return (
    <div
      className="bg-surface-sunken h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Fund progress"
    >
      <div
        className="bg-success h-full rounded-full transition-[width]"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
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
        className={
          tone === 'success'
            ? 'text-success text-lg font-semibold tracking-tight'
            : tone === 'danger'
              ? 'text-danger text-lg font-semibold tracking-tight'
              : 'text-ink text-lg font-semibold tracking-tight'
        }
      >
        {value}
      </div>
      <div className="text-ink-subtle mt-0.5 text-[11px] font-medium tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}
