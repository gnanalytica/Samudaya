import { Eye } from 'lucide-react';
import { VIEW_MODE_LABEL, type ViewMode } from '@samudaya/core';
import { switchView } from '@/app/app/[community]/view-actions';
import { cn } from '@/lib/utils';

const MODES: ViewMode[] = ['committee', 'resident'];

/**
 * Committee ↔ resident toggle for the sidebar. Plain forms, so it works
 * before any client JavaScript has loaded.
 */
export function ViewSwitch({ slug, mode }: { slug: string; mode: ViewMode }) {
  return (
    <div
      role="group"
      aria-label="Choose what you see"
      className="bg-surface-sunken grid grid-cols-2 gap-1 rounded-lg p-1"
    >
      {MODES.map((option) => (
        <form key={option} action={switchView}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="mode" value={option} />
          <button
            type="submit"
            aria-pressed={mode === option}
            disabled={mode === option}
            className={cn(
              'w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              mode === option
                ? 'bg-surface-raised text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option === 'committee' ? 'Committee' : 'Resident'}
          </button>
        </form>
      ))}
    </div>
  );
}

/** A reminder strip while the committee is looking at the resident view. */
export function ResidentViewBanner({ slug }: { slug: string }) {
  return (
    <div className="border-border-base bg-accent/10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm md:px-6">
      <p className="text-ink flex items-center gap-2">
        <Eye className="size-4 shrink-0" aria-hidden="true" />
        {VIEW_MODE_LABEL.resident}: you’re seeing what residents see.
      </p>
      <form action={switchView}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="mode" value="committee" />
        <button type="submit" className="text-accent font-medium hover:underline">
          Back to committee view
        </button>
      </form>
    </div>
  );
}
