import Link from 'next/link';
import { ArrowRight, Bell, PartyPopper, Plus, Receipt, Users, Wrench } from 'lucide-react';
import { can, formatMoney, relativeTime, ticketRef, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RequestStatusBadge, VisitorStatusBadge } from '@/components/status-badge';

export default async function DashboardPage(props: PageProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  const { joined, welcome } = await props.searchParams;
  const { community, role, profile, unitIds } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const base = `/app/${community.slug}`;
  const now = new Date().toISOString();

  // One round trip for the whole dashboard. RLS scopes every one of these to
  // what this member is allowed to see, so no extra filtering is needed here.
  const [notices, myRequests, visitors, invoices, units] = await Promise.all([
    supabase
      .from('announcements')
      .select('id, title, body, published_at, is_pinned')
      .eq('community_id', community.id)
      .lte('published_at', now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('service_requests')
      .select('id, ticket_no, title, status, priority, created_at')
      .eq('community_id', community.id)
      .in('status', ['open', 'acknowledged', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('visitor_passes')
      .select('id, visitor_name, kind, status, expected_at, pass_code')
      .eq('community_id', community.id)
      .in('status', ['expected', 'arrived'])
      .gte('valid_until', now)
      .order('expected_at', { ascending: true })
      .limit(4),
    supabase
      .from('invoices')
      .select('id, number, title, total, amount_paid, balance_due, due_date, status')
      .eq('community_id', community.id)
      .in('status', ['issued', 'partly_paid', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(4),
    supabase
      .from('units')
      .select('id, block, number')
      .eq('community_id', community.id)
      .in('id', unitIds.length > 0 ? unitIds : ['00000000-0000-0000-0000-000000000000']),
  ]);

  const outstanding = (invoices.data ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.balance_due ?? 0),
    0,
  );
  const myUnits = (units.data ?? []).map((unit) => unitLabel(unit)).join(', ');
  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : community.name}
        description={myUnits ? `${community.name} · ${myUnits}` : community.name}
        action={
          <ButtonLink href={`${base}/requests/new`} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Raise a request
          </ButtonLink>
        }
      />

      <PageBody>
        {joined || welcome ? (
          <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 mb-5 flex items-start gap-3 rounded-xl border p-4">
            <PartyPopper className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p className="text-ink font-medium">
                {welcome ? `${community.name} is ready.` : `You’ve joined ${community.name}.`}
              </p>
              <p className="text-ink-muted mt-0.5">
                {welcome
                  ? 'Next: add your units, then create invite codes so residents can join.'
                  : 'Have a look around — notices, requests and your dues are all here.'}
              </p>
              {welcome && can(role, 'invites:manage') ? (
                <Link
                  href={`${base}/admin/invites`}
                  className="text-accent mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-4"
                >
                  Create invite codes
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Latest notices"
              action={
                <Link href={`${base}/notices`} className="text-accent text-sm hover:underline">
                  All
                </Link>
              }
            />
            {notices.data?.length ? (
              <ul className="divide-border-base divide-y">
                {notices.data.map((notice) => (
                  <li key={notice.id} className="px-5 py-3">
                    <Link href={`${base}/notices`} className="group block">
                      <p className="text-ink group-hover:text-accent flex items-center gap-2 text-sm font-medium">
                        {notice.is_pinned ? (
                          <span
                            className="bg-accent inline-block size-1.5 rounded-full"
                            aria-label="Pinned"
                          />
                        ) : null}
                        {notice.title}
                      </p>
                      <p className="text-ink-muted mt-0.5 line-clamp-2 text-sm">{notice.body}</p>
                      <p className="text-ink-subtle mt-1 text-xs">
                        {relativeTime(notice.published_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Bell className="size-6" />}
                title="No notices yet"
                description="Announcements from the committee will show up here."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Open requests"
              action={
                <Link href={`${base}/requests`} className="text-accent text-sm hover:underline">
                  All
                </Link>
              }
            />
            {myRequests.data?.length ? (
              <ul className="divide-border-base divide-y">
                {myRequests.data.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`${base}/requests/${request.id}`}
                      className="hover:bg-surface-sunken flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink truncate text-sm font-medium">{request.title}</p>
                        <p className="text-ink-subtle mt-0.5 font-mono text-xs">
                          {ticketRef(request.ticket_no)} · {relativeTime(request.created_at)}
                        </p>
                      </div>
                      <RequestStatusBadge status={request.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Wrench className="size-6" />}
                title="Nothing open"
                description="Report a leak, a broken light or anything else that needs fixing."
                action={
                  <ButtonLink href={`${base}/requests/new`} size="sm" variant="secondary">
                    Raise a request
                  </ButtonLink>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Expected visitors"
              action={
                <Link href={`${base}/visitors`} className="text-accent text-sm hover:underline">
                  All
                </Link>
              }
            />
            {visitors.data?.length ? (
              <ul className="divide-border-base divide-y">
                {visitors.data.map((visitor) => (
                  <li
                    key={visitor.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-ink truncate text-sm font-medium">
                        {visitor.visitor_name}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {relativeTime(visitor.expected_at)} · code{' '}
                        <span className="font-mono">{visitor.pass_code}</span>
                      </p>
                    </div>
                    <VisitorStatusBadge status={visitor.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Users className="size-6" />}
                title="No one expected"
                description="Pre-approve a guest and they’ll get a code for the gate."
                action={
                  <ButtonLink href={`${base}/visitors/new`} size="sm" variant="secondary">
                    Invite a visitor
                  </ButtonLink>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Dues"
              action={
                <Link href={`${base}/billing`} className="text-accent text-sm hover:underline">
                  All
                </Link>
              }
            />
            {invoices.data?.length ? (
              <CardBody className="space-y-3">
                <div>
                  <p className="text-ink text-2xl font-semibold tracking-tight">
                    {formatMoney(outstanding, community.currency)}
                  </p>
                  <p className="text-ink-muted text-sm">
                    across {invoices.data.length}{' '}
                    {invoices.data.length === 1 ? 'invoice' : 'invoices'}
                  </p>
                </div>
                <ButtonLink href={`${base}/billing`} size="sm" variant="secondary">
                  View bills
                </ButtonLink>
              </CardBody>
            ) : (
              <EmptyState
                icon={<Receipt className="size-6" />}
                title="Nothing outstanding"
                description="You’re all settled up."
              />
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
