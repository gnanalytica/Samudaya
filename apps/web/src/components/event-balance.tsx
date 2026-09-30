import Link from 'next/link';
import { formatMoney, type EventMoney } from '@samudaya/core';
import { cn } from '@/lib/utils';
import { Card, CardBody } from './ui/card';
import { SpendBar, SpendKey, StatTile, StatTiles } from './badges';

/** A balance, with a minus sign a person can read when it is below zero. */
export function balanceText(balance: number, currency: string): string {
  return balance < 0 ? `−${formatMoney(-balance, currency)}` : formatMoney(balance, currency);
}

/**
 * The Fund card's three tiles, which add up on screen: what this event
 * collected, less what it spent, is its balance. Collected includes money the
 * committee carried in — once it arrives it is this event's to spend — and
 * never the society's balance or another event's.
 */
export function EventMoneyTiles({
  money,
  currency,
  className,
}: {
  money: EventMoney;
  currency: string;
  className?: string;
}) {
  return (
    <StatTiles className={className}>
      <StatTile
        label="Collected"
        value={formatMoney(money.collected, currency)}
        hint={
          money.carriedIn > 0
            ? `${formatMoney(money.fromResidents, currency)} from residents + ${formatMoney(money.carriedIn, currency)} carried in`
            : 'From residents'
        }
      />
      <StatTile label="Spent" value={formatMoney(money.spent, currency)} hint="Approved bills" />
      <StatTile
        label="Balance"
        value={balanceText(money.balance, currency)}
        tone={money.balance < 0 ? 'danger' : 'success'}
        hint={
          money.overBy > 0
            ? 'Spent more than collected'
            : money.movedOut > 0
              ? `Collected less spent, after ${formatMoney(money.movedOut, currency)} moved on`
              : 'Collected less spent'
        }
      />
    </StatTiles>
  );
}

/**
 * What staff and the committee see first on an event: how much of its money
 * is left, so nobody commits to a bill the event cannot pay. Over zero it
 * says who has to act — somebody paid the difference and is owed it.
 */
export function EventBalanceCard({
  money,
  currency,
  todoHref,
  className,
}: {
  money: EventMoney;
  currency: string;
  /** Where the committee pays an overspend back. */
  todoHref?: string;
  className?: string;
}) {
  const over = money.overBy > 0;
  return (
    <Card className={className}>
      <CardBody className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div>
            <p className="text-gold text-[10.5px] font-semibold tracking-[0.14em] uppercase">
              {over ? 'Over its fund' : 'Left to spend'}
            </p>
            <p
              className={cn(
                'font-serif text-[28px] leading-tight font-medium tracking-tight',
                over ? 'text-danger' : 'text-ink',
              )}
            >
              {balanceText(money.balance, currency)}
            </p>
          </div>
          <p className="text-ink-muted text-sm">
            {formatMoney(money.spent, currency)} spent of {formatMoney(money.collected, currency)}{' '}
            collected
          </p>
        </div>
        <SpendBar percent={money.spentPercent} over={over} />
        <SpendKey spent={money.spent} balance={money.balance} currency={currency} />
        {over ? (
          <p className="text-danger text-sm">
            Somebody paid the difference out of their own pocket.{' '}
            {todoHref ? (
              <Link href={todoHref} className="font-medium underline underline-offset-2">
                Pay them back
              </Link>
            ) : (
              'The committee pays them back.'
            )}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
