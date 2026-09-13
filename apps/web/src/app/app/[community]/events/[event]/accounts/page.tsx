import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';
import {
  FUND_RULE_LABEL,
  can,
  formatDate,
  formatMoney,
  fundedPercent,
  receiptRef,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import {
  budgetVsSpent,
  getBudgetLines,
  getEventStats,
  getExpenses,
  requireEvent,
} from '@/lib/events';
import { BillLink } from '@/components/bill-link';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ExpenseStatusBadge, FundBar, StatTile } from '@/components/badges';

export const metadata = { title: 'Accounts' };

export default async function AccountsPage(
  props: PageProps<'/app/[community]/events/[event]/accounts'>,
) {
  const { community: slug, event: eventSlug } = await props.params;
  const { community, role, membership } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);
  const supabase = await getSupabase();

  const [stats, expenses, budget, myContributions] = await Promise.all([
    getEventStats(event.id),
    getExpenses(event.id),
    getBudgetLines(event.id),
    supabase
      .from('contributions')
      .select('id, amount, method, receipt_no, paid_at')
      .eq('event_id', event.id)
      .eq('membership_id', membership.id)
      // Receipts are for confirmed payments; reported ones are still waiting.
      .eq('status', 'succeeded')
      .order('paid_at', { ascending: false }),
  ]);

  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const approved = expenses.filter((expense) => expense.status === 'approved');
  const awaiting = expenses.filter((expense) => expense.status !== 'approved');
  const isStaff = can(role, 'events:manage');
  const categories = budgetVsSpent(budget, expenses);
  const plannedTotal = categories.reduce((sum, row) => sum + row.planned, 0);
  const largest = Math.max(1, ...categories.map((row) => Math.max(row.planned, row.spent)));

  return (
    <>
      <PageHeader
        title={`${event.emoji} ${event.name} · money`}
        description="Raised, planned and spent, with every approved bill."
      />
      <PageBody>
        <Link
          href={`/app/${slug}/events/${event.slug}`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the event
        </Link>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Collected" value={formatMoney(stats.fundRaised, community.currency)} />
          <StatTile label="Spent" value={formatMoney(stats.spent, community.currency)} />
          <StatTile
            label="Available"
            value={formatMoney(stats.available, community.currency)}
            tone={stats.available < 0 ? 'danger' : 'success'}
          />
        </div>

        <Card className="mt-4">
          <CardBody>
            <div className="text-ink-muted flex justify-between text-sm font-medium">
              <span>Against a target of {formatMoney(stats.fundTarget, community.currency)}</span>
              <span>{funded}%</span>
            </div>
            <div className="mt-2">
              <FundBar percent={funded} />
            </div>
            <p className="text-ink-subtle mt-2 text-xs">
              {stats.contributors} {stats.contributors === 1 ? 'household' : 'households'}{' '}
              contributed.
              {plannedTotal > 0
                ? ` Budget used: ${Math.round((stats.spent / plannedTotal) * 100)}% of ${formatMoney(plannedTotal, community.currency)}.`
                : ''}
            </p>
          </CardBody>
        </Card>

        {categories.length ? (
          <>
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Planned vs spent</h2>
            <Card>
              <CardBody className="space-y-4">
                <div className="text-ink-subtle flex gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-border-strong inline-block size-2.5 rounded-sm" /> Planned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-accent inline-block size-2.5 rounded-sm" /> Spent
                  </span>
                </div>
                {categories.map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-ink font-medium">{row.label}</span>
                      <span
                        className={
                          row.planned > 0 && row.spent > row.planned
                            ? 'text-danger'
                            : 'text-ink-muted'
                        }
                      >
                        {formatMoney(row.spent, community.currency)} /{' '}
                        {formatMoney(row.planned, community.currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <div className="bg-surface-sunken h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-border-strong h-full rounded-full"
                          style={{ width: `${(row.planned / largest) * 100}%` }}
                        />
                      </div>
                      <div className="bg-surface-sunken h-2 overflow-hidden rounded-full">
                        <div
                          className={
                            row.planned > 0 && row.spent > row.planned
                              ? 'bg-danger h-full rounded-full'
                              : 'bg-accent h-full rounded-full'
                          }
                          style={{ width: `${(row.spent / largest) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </>
        ) : null}

        <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">
          Expenses ({approved.length})
        </h2>
        <Card>
          {approved.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      What
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Vendor
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Trail
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Bill
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border-base divide-y">
                  {approved.map((expense) => (
                    <tr key={expense.id}>
                      <td className="px-5 py-3">
                        <p className="text-ink font-medium">{expense.name}</p>
                        <p className="text-ink-subtle text-xs">
                          {expense.category ?? '—'} · {formatDate(expense.spent_on)}
                        </p>
                      </td>
                      <td className="text-ink-muted px-5 py-3">{expense.vendor ?? '—'}</td>
                      <td className="text-ink-subtle px-5 py-3 text-xs">
                        {expense.requester?.profiles?.full_name ? (
                          <>asked by {expense.requester.profiles.full_name}</>
                        ) : null}
                        {expense.approver?.profiles?.full_name ? (
                          <>
                            <br />
                            approved by {expense.approver.profiles.full_name}
                          </>
                        ) : null}
                      </td>
                      <td className="text-ink px-5 py-3 text-right font-medium">
                        {formatMoney(expense.amount, community.currency)}
                      </td>
                      <td className="px-5 py-3">
                        {expense.bill_url ? (
                          <BillLink url={expense.bill_url} />
                        ) : (
                          <span className="text-ink-subtle text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-border-base bg-surface-sunken border-t">
                    <td colSpan={3} className="text-ink px-5 py-3 text-sm font-semibold">
                      Total spent
                    </td>
                    <td className="text-ink px-5 py-3 text-right text-sm font-semibold">
                      {formatMoney(stats.spent, community.currency)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="Nothing spent yet"
              description="Once an expense is approved it appears here, with its bill, for everyone."
            />
          )}
        </Card>

        {isStaff && awaiting.length ? (
          <>
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">
              Waiting for the committee
            </h2>
            <Card>
              <ul className="divide-border-base divide-y">
                {awaiting.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{expense.name}</p>
                      <p className="text-ink-subtle text-xs">
                        {expense.vendor ?? '—'}
                        {expense.review_note ? ` · ${expense.review_note}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-ink-muted text-sm">
                        {formatMoney(expense.amount, community.currency)}
                      </span>
                      <ExpenseStatusBadge status={expense.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ) : null}

        {myContributions.data?.length ? (
          <>
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Your contributions</h2>
            <Card>
              <ul className="divide-border-base divide-y">
                {myContributions.data.map((contribution) => (
                  <li
                    key={contribution.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div>
                      <p className="text-ink text-sm font-medium">
                        {formatMoney(contribution.amount, community.currency)}
                      </p>
                      <p className="text-ink-subtle text-xs">
                        <span className="font-mono">
                          {receiptRef(event.slug, contribution.receipt_no)}
                        </span>
                        {' · '}
                        {formatDate(contribution.paid_at.slice(0, 10))}
                        {' · '}
                        <span className="uppercase">{contribution.method}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ) : null}

        <div className="border-border-base bg-surface-sunken text-ink-muted mt-6 rounded-lg border px-4 py-3 text-sm">
          🔒 <span className="text-ink font-medium">Surplus rule:</span>{' '}
          {event.fund_rule_note ?? FUND_RULE_LABEL[event.fund_rule]}
          <p className="text-ink-subtle mt-1 text-xs">
            Fixed when the event was created, before any money was collected.
          </p>
        </div>
      </PageBody>
    </>
  );
}
