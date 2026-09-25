import { carriedFromLine, carriedInLine, type CarriedInRow } from '@samudaya/core';
import { cn } from '@/lib/utils';

/**
 * Money the society already had, moved behind this event by the committee:
 * how it changes what residents are asked for, then each sum — where it came
 * from, who decided it and when.
 *
 * Said out loud rather than folded into the raised figure: "sixty flats gave
 * ₹30,000" and "the committee moved ₹10,000 across from last year" are
 * different sentences, and the second one carries a name.
 */
export function CarriedIn({
  target,
  carried,
  movements,
  currency,
  className,
}: {
  target: number;
  carried: number;
  movements: (CarriedInRow & { id: string })[];
  currency: string;
  className?: string;
}) {
  const summary = carriedInLine(target, carried, currency);
  if (!summary) return null;
  return (
    <div className={cn('text-ink-subtle mt-2 space-y-0.5 text-xs', className)}>
      <p>{summary}</p>
      {movements.map((movement) => (
        <p key={movement.id}>{carriedFromLine(movement, currency)}</p>
      ))}
    </div>
  );
}
