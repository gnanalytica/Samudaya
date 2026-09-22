import { PiggyBank, Scale, Wallet } from 'lucide-react';
import {
  LEDGER_FILTERS,
  filterLedger,
  formatDate,
  formatMoney,
  fundMovementLine,
  ledgerFilterFrom,
  relativeTime,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getFundMovements, getSocietyBalance } from '@/lib/events';
import { getSupabase } from '@/lib/supabase/server';
import { rowsOf } from '@/lib/rows';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile, StatTiles } from '@/components/badges';
import { LedgerRow } from '@/components/ledger-row';

export const metadata = { title: 'Money' };

/**
 * The society's money, all of it, for everybody.
 *
 * A resident could already see where the money went for the event they happened
 * to be looking at, and nowhere could they see the whole thing: what came in
 * last Deepavali, what it was spent on, what is left, and what the year before
 * looked like. The history existed and was unreachable, which for a
 * transparency ledger is close to not existing.
 *
 * Money in names the payer, their flat and how they paid; money out names the
 * vendor — the line society_ledger draws and explains. Payments nobody has
 * confirmed are not here: a ledger of claims is what this replaces.
 *
 * Every row carries its evidence where there is any to carry: the bill behind
 * a payment out, which every member may open, and the screenshot behind a
 * payment in, which the view hands only to the payer and to staff.
 */
export default async function MoneyPage(props: PageProps<'/app/[community]/money'>) {
  const { community: slug } = await props.params;
  const { show, event } = await props.searchParams;
  const { community } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const [ledger, totals, society, movements] = await Promise.all([
    supabase
      .from('society_ledger')
      .select(
        'id, direction, happened_at, amount, counterpart, detail, payer_name, unit_label, method, receipt_no, document_url, confirmed_by, confirmed_at, event_slug, event_name',
      )
      .eq('community_id', community.id)
      .order('happened_at', { ascending: false })
      .limit(500),
    supabase.from('society_money').select('*').eq('community_id', community.id).maybeSingle(),
    getSocietyBalance(community.id),
    getFundMovements(community.id),
  ]);

  const rows = rowsOf(ledger, 'the society ledger');
  const filter = ledgerFilterFrom(show);
  const eventFilter = typeof event === 'string' ? event : '';
  const visible = filterLedger(rows, filter, eventFilter);

  // Built from the ledger rather than from events, so the filter only ever
  // offers a year that has something in it.
  const events = [...new Map(rows.map((row) => [row.event_slug, row.event_name])).entries()]
    .filter(([value]) => value)
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])));

  const balance = Number(totals.data?.balance ?? 0);

  return (
    <>
      <PageHeader
        title="Money"
        description={`Every rupee ${community.name} has taken in and spent, since the day it started.`}
      />
      <PageBody>
        <StatTiles>
          <StatTile
            label="Collected"
            value={formatMoney(Number(totals.data?.total_in ?? 0), community.currency)}
          />
          <StatTile
            label="Spent"
            value={formatMoney(Number(totals.data?.total_out ?? 0), community.currency)}
          />
          <StatTile
            label="Balance"
            value={formatMoney(balance, community.currency)}
            tone={balance < 0 ? 'danger' : 'success'}
          />
        </StatTiles>

        {/* Where the money left in a closed event went. The home screen links
            straight here, because "the society is holding ₹12,000" is only
            worth saying if the next question — from what, and decided by
            whom — has an answer on the same screen. */}
        {movements.length ? (
          <Card className="mt-5 scroll-mt-20" id="society-balance">
            <CardHeader
              title="Society balance"
              description="What was left over when an event closed, and what the committee decided to do with it."
            />
            <CardBody className="border-border-base flex items-center gap-3 border-b">
              <PiggyBank className="text-accent size-6 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-ink text-lg font-semibold">
                  {formatMoney(society.balance, community.currency)}
                </p>
                <p className="text-ink-subtle text-xs">
                  Held by the society and not behind any event
                </p>
              </div>
            </CardBody>
            <ul className="divide-border-base divide-y">
              {movements.map((movement) => (
                <li key={movement.id} className="px-5 py-3">
                  <p className="text-ink text-sm">
                    {fundMovementLine(movement, community.currency)}
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    {movement.decided_at ? formatDate(movement.decided_at.slice(0, 10)) : ''}
                    {movement.decider?.profiles?.full_name
                      ? ` · decided by ${movement.decider.profiles.full_name}`
                      : ''}
                    {movement.note ? ` · ${movement.note}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="mt-5">
          <CardHeader
            title="Every transaction"
            description="Confirmed payments in and approved bills out. A payment waiting to be confirmed is not here yet."
          />
          <CardBody className="border-border-base border-b">
            {/* A GET form, so a filtered ledger is a link somebody can send to
                a neighbour who is asking where the money went. */}
            <form method="get" className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="show" className="text-ink-subtle mb-1 block text-xs font-medium">
                  Showing
                </label>
                <select
                  id="show"
                  name="show"
                  defaultValue={filter}
                  className="border-border-base bg-surface-raised text-ink rounded-lg border px-3 py-2 pr-8 text-base sm:text-sm"
                >
                  {LEDGER_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {events.length > 1 ? (
                <div>
                  <label htmlFor="event" className="text-ink-subtle mb-1 block text-xs font-medium">
                    Event
                  </label>
                  <select
                    id="event"
                    name="event"
                    defaultValue={eventFilter}
                    className="border-border-base bg-surface-raised text-ink rounded-lg border px-3 py-2 pr-8 text-base sm:text-sm"
                  >
                    <option value="">Every event</option>
                    {events.map(([value, label]) => (
                      <option key={value} value={value ?? ''}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                type="submit"
                className="border-border-base bg-surface-raised text-ink hover:bg-surface-sunken rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Apply
              </button>
            </form>
          </CardBody>

          {visible.length ? (
            <ul className="divide-border-base divide-y">
              {visible.map((row) => (
                <LedgerRow key={row.id} row={row} slug={slug} currency={community.currency} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Wallet className="size-6" />}
              title={rows.length ? 'Nothing matches that' : 'Nothing has moved yet'}
              description={
                rows.length
                  ? 'Try a different filter.'
                  : 'Confirmed payments and approved bills appear here, for every event, for ever.'
              }
            />
          )}
        </Card>

        <p className="text-ink-subtle mt-4 flex items-start gap-2 text-xs">
          <Scale className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Money in names who paid, their flat and how the money arrived, the way a contribution
            list always has. Money out names the vendor, the amount and whoever on the committee
            approved it, with the bill attached for anyone to open. A payment screenshot is not
            everybody&rsquo;s — it carries the payer&rsquo;s UPI handle — so it opens only for them
            and for staff. Nothing here is a way to contact anybody: phone numbers and email
            addresses stay on the People page, for the people entitled to them.{' '}
            {totals.data?.last_movement_at ? (
              <>Last movement {relativeTime(totals.data.last_movement_at)}.</>
            ) : null}
          </span>
        </p>

        {visible.length >= 500 ? (
          <p className="text-ink-subtle mt-2 text-xs">
            <Badge tone="neutral">Showing the most recent 500</Badge>
          </p>
        ) : null}
      </PageBody>
    </>
  );
}
