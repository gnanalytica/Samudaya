import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock, RefreshCw, XCircle } from 'lucide-react';
import { relativeTime } from '@samudaya/core';
import { getMemberships, getProfile, requireUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { Card, CardBody } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { JoinFlow } from './join-flow';
import { withdrawJoinRequest } from './actions';

export const metadata = { title: 'Join your society' };

/**
 * The caller's own latest request. Applicants cannot read the society or its
 * flats yet, so the pending screen shows what they submitted about themselves.
 */
async function latestRequest(userId: string) {
  const supabase = await getSupabase();
  const { data: request } = await supabase
    .from('join_requests')
    .select(
      'id, unit_id, claimed_name, claimed_phone, relation, status, decline_reason, created_at, updated_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request) return null;

  return {
    ...request,
    // Step one files the request before the flat is picked and step two
    // refreshes it, so a request counts as submitted once it has a flat or has
    // been refreshed by the details step.
    submitted: Boolean(request.unit_id) || request.updated_at > request.created_at,
  };
}

export default async function OnboardingPage(props: PageProps<'/onboarding'>) {
  const user = await requireUser();
  const { mode, code } = await props.searchParams;
  const profile = await getProfile();
  // From a shared join link: /join/CODE fills the society code in.
  const initialCode = typeof code === 'string' ? code.toUpperCase().slice(0, 16) : '';

  const memberships = await getMemberships();
  const firstSlug = memberships[0]?.communities?.slug;
  if (firstSlug && mode !== 'join') redirect(`/app/${firstSlug}`);

  const request = mode === 'join' && firstSlug ? null : await latestRequest(user.id);
  const pending = request?.status === 'pending' && request.submitted ? request : null;
  const declined = request?.status === 'rejected' && mode !== 'join' ? request : null;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start">
        <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg text-sm font-bold">
          स
        </span>
        <span className="text-lg font-semibold tracking-tight">Samudaya</span>
      </Link>

      {pending ? (
        <Card>
          <CardBody className="py-8 text-center">
            <Clock className="text-accent mx-auto size-10" aria-hidden="true" />
            <h1 className="text-ink mt-4 text-xl font-semibold tracking-tight">
              Waiting for approval
            </h1>
            <p className="text-ink-muted mt-1.5 text-sm">
              Your request is with your society’s staff. You’ll see events and accounts as soon as
              they approve it.
            </p>
            <dl className="border-border-base bg-surface-sunken mt-5 space-y-1 rounded-xl border p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Name</dt>
                <dd className="text-ink font-medium">{pending.claimed_name}</dd>
              </div>
              {pending.claimed_phone ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Mobile</dt>
                  <dd className="text-ink font-medium">{pending.claimed_phone}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Joining as</dt>
                <dd className="text-ink font-medium capitalize">
                  {pending.relation === 'other' ? 'Works for the society' : pending.relation}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Sent</dt>
                <dd className="text-ink font-medium">{relativeTime(pending.created_at)}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/onboarding" size="sm">
                <RefreshCw className="size-4" aria-hidden="true" />
                Check again
              </ButtonLink>
              <form action={withdrawJoinRequest}>
                <input type="hidden" name="request_id" value={pending.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Withdraw and start over
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Join your society</h1>
          <p className="text-ink-muted mt-1.5 mb-6 text-sm">
            Enter the society code your committee shared, then tell us which flat is yours.
          </p>

          {declined ? (
            <div className="border-danger/30 bg-danger/10 mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm">
              <XCircle className="text-danger mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-ink font-medium">Your last request to join wasn’t approved.</p>
                <p className="text-ink-muted mt-0.5">
                  {declined.decline_reason ?? 'Check your flat and details with the committee.'}
                </p>
              </div>
            </div>
          ) : null}

          <JoinFlow initialCode={initialCode} initialName={profile?.full_name ?? ''} />
        </>
      )}

      <form action="/auth/signout" method="post" className="mt-8 text-center">
        <button type="submit" className="text-ink-subtle text-xs underline underline-offset-4">
          Sign out
        </button>
      </form>
    </main>
  );
}
