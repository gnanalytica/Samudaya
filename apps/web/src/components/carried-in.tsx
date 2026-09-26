import { carriedFromLine, type CarriedInRow } from '@samudaya/core';
import { cn } from '@/lib/utils';

/**
 * Money the committee carried into this event, one row per sum: where it came
 * from, who decided it and when. It is counted in the fund like any other
 * money (inTheFund); this is its entry in the event's money, the way a
 * contribution has a payer and a bill has an approver.
 */
export function CarriedIn({
  movements,
  currency,
  className,
}: {
  movements: (CarriedInRow & { id: string })[];
  currency: string;
  className?: string;
}) {
  if (!movements.length) return null;
  return (
    <ul className={cn('text-ink-subtle mt-2 space-y-0.5 text-xs', className)}>
      {movements.map((movement) => (
        <li key={movement.id}>+ {carriedFromLine(movement, currency)}</li>
      ))}
    </ul>
  );
}
