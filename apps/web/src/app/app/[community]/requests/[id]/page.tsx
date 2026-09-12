import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import {
  REQUEST_CATEGORY_LABEL,
  REQUEST_PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  can,
  relativeTime,
  ticketRef,
  unitLabel,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { PriorityBadge, RequestStatusBadge } from '@/components/status-badge';
import { CommentForm } from './comment-form';
import { updateRequest } from '../actions';

export default async function RequestDetailPage(
  props: PageProps<'/app/[community]/requests/[id]'>,
) {
  const { community: slug, id } = await props.params;
  const { community, role } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const { data: request } = await supabase
    .from('service_requests')
    // Written as one literal on purpose: supabase-js infers the row type from
    // the select string, and concatenating with `+` widens it to `string`,
    // which collapses the whole result to an error type.
    .select(
      'id, ticket_no, title, description, category, status, priority, created_at, acknowledged_at, resolved_at, channel, units(block, number), raised:memberships!service_requests_raised_by_fkey(id, profiles(full_name)), assignee:memberships!service_requests_assigned_to_fkey(id, profiles(full_name))',
    )
    .eq('id', id)
    .maybeSingle();

  // RLS hides other people's requests, so "not visible" and "not there" are
  // the same thing from here.
  if (!request) notFound();

  const { data: comments } = await supabase
    .from('service_request_comments')
    .select('id, body, is_internal, created_at, memberships(profiles(full_name))')
    .eq('request_id', id)
    .order('created_at', { ascending: true });

  const isStaff = can(role, 'requests:triage');
  const base = `/app/${community.slug}`;

  return (
    <>
      <PageHeader
        title={request.title}
        description={`${ticketRef(request.ticket_no)} · raised ${relativeTime(request.created_at)}${
          request.channel !== 'web' ? ` via ${request.channel}` : ''
        }`}
        action={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={request.priority} />
            <RequestStatusBadge status={request.status} />
          </div>
        }
      />

      <PageBody>
        <Link
          href={`${base}/requests`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All requests
        </Link>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {request.description ? (
              <Card>
                <CardBody>
                  <p className="text-ink text-sm whitespace-pre-wrap">{request.description}</p>
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader title={`Updates (${comments?.length ?? 0})`} />
              {comments?.length ? (
                <ul className="divide-border-base divide-y">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className={comment.is_internal ? 'bg-warning/5 px-5 py-3' : 'px-5 py-3'}
                    >
                      <div className="text-ink-subtle flex items-center gap-2 text-xs">
                        <span className="text-ink-muted font-medium">
                          {comment.memberships?.profiles?.full_name ?? 'Someone'}
                        </span>
                        <span>·</span>
                        <span>{relativeTime(comment.created_at)}</span>
                        {comment.is_internal ? (
                          <Badge tone="warning" className="ml-1">
                            <Lock className="size-3" aria-hidden="true" />
                            Internal
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-ink mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardBody>
                  <p className="text-ink-muted text-sm">No updates yet.</p>
                </CardBody>
              )}
              <CardBody className="border-border-base border-t">
                <CommentForm slug={slug} requestId={request.id} canAddInternal={isStaff} />
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Category</dt>
                    <dd className="text-ink text-right font-medium">
                      {REQUEST_CATEGORY_LABEL[request.category]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Priority</dt>
                    <dd className="text-ink text-right font-medium">
                      {REQUEST_PRIORITY_LABEL[request.priority]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Unit</dt>
                    <dd className="text-ink text-right font-medium">
                      {request.units ? unitLabel(request.units) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Raised by</dt>
                    <dd className="text-ink text-right font-medium">
                      {request.raised?.profiles?.full_name ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Assigned to</dt>
                    <dd className="text-ink text-right font-medium">
                      {request.assignee?.profiles?.full_name ?? 'Nobody yet'}
                    </dd>
                  </div>
                  {request.resolved_at ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">Resolved</dt>
                      <dd className="text-ink text-right font-medium">
                        {relativeTime(request.resolved_at)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </CardBody>
            </Card>

            {isStaff ? (
              <Card>
                <CardHeader title="Triage" />
                <CardBody>
                  <form action={updateRequest} className="space-y-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={request.id} />
                    <div>
                      <label htmlFor="status" className="text-ink-muted mb-1.5 block text-sm">
                        Status
                      </label>
                      <Select id="status" name="status" defaultValue={request.status}>
                        {Object.entries(REQUEST_STATUS_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="priority" className="text-ink-muted mb-1.5 block text-sm">
                        Priority
                      </label>
                      <Select id="priority" name="priority" defaultValue={request.priority}>
                        {Object.entries(REQUEST_PRIORITY_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button type="submit" size="sm" variant="secondary" className="w-full">
                      Update
                    </Button>
                  </form>
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}
