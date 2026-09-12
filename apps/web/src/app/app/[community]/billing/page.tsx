import { Receipt } from 'lucide-react';
import { can, formatMoney, invoiceRef, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { InvoiceStatusBadge } from '@/components/status-badge';

export const metadata = { title: 'Dues' };

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function BillingPage(props: PageProps<'/app/[community]/billing'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const isAdmin = can(role, 'billing:manage');

  // RLS narrows this to the caller's own flats unless they manage billing.
  const [invoices, payments] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, number, title, total, amount_paid, balance_due, due_date, issue_date, status, units(block, number)',
      )
      .eq('community_id', community.id)
      .order('due_date', { ascending: false })
      .limit(100),
    supabase
      .from('payments')
      .select('id, amount, method, status, paid_at, reference, invoices(number)')
      .eq('community_id', community.id)
      .eq('status', 'succeeded')
      .order('paid_at', { ascending: false })
      .limit(20),
  ]);

  const outstanding = (invoices.data ?? [])
    .filter((invoice) => ['issued', 'partly_paid', 'overdue'].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Dues"
        description={
          isAdmin
            ? 'Every invoice raised in the community.'
            : 'Invoices and payments for your flat.'
        }
      />
      <PageBody>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-ink-muted text-sm">Outstanding</p>
              <p className="text-ink mt-1 text-2xl font-semibold tracking-tight">
                {formatMoney(outstanding, community.currency)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-ink-muted text-sm">Invoices</p>
              <p className="text-ink mt-1 text-2xl font-semibold tracking-tight">
                {invoices.data?.length ?? 0}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-ink-muted text-sm">Recent payments</p>
              <p className="text-ink mt-1 text-2xl font-semibold tracking-tight">
                {payments.data?.length ?? 0}
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Invoices" />
          {invoices.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Invoice
                    </th>
                    {isAdmin ? (
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Unit
                      </th>
                    ) : null}
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Due
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Total
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Balance
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border-base divide-y">
                  {invoices.data.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-5 py-3">
                        <span className="text-ink-muted font-mono text-xs">
                          {invoiceRef(invoice.number)}
                        </span>
                        <p className="text-ink">{invoice.title}</p>
                      </td>
                      {isAdmin ? (
                        <td className="text-ink-muted px-5 py-3">
                          {invoice.units ? unitLabel(invoice.units) : '—'}
                        </td>
                      ) : null}
                      <td className="text-ink-muted px-5 py-3">{formatDate(invoice.due_date)}</td>
                      <td className="text-ink px-5 py-3 text-right">
                        {formatMoney(invoice.total, community.currency)}
                      </td>
                      <td className="text-ink px-5 py-3 text-right font-medium">
                        {formatMoney(invoice.balance_due, community.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="No invoices"
              description={
                isAdmin
                  ? 'Raise maintenance invoices per unit to start tracking dues.'
                  : 'Nothing has been billed to your flat yet.'
              }
            />
          )}
        </Card>

        {payments.data?.length ? (
          <Card className="mt-5">
            <CardHeader title="Recent payments" />
            <ul className="divide-border-base divide-y">
              {payments.data.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm">
                      {formatMoney(payment.amount, community.currency)}
                      <span className="text-ink-subtle ml-2 text-xs uppercase">
                        {payment.method}
                      </span>
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {formatDate(payment.paid_at)}
                      {payment.invoices ? ` · ${invoiceRef(payment.invoices.number)}` : ''}
                      {payment.reference ? ` · ${payment.reference}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}
