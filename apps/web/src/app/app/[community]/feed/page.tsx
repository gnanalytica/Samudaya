import { Lightbulb, Users } from 'lucide-react';
import { relativeTime, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { InterestButton, PollCard, ReallocationCard, SuggestForm } from './feed-forms';

export const metadata = { title: 'Community' };

export default async function FeedPage(props: PageProps<'/app/[community]/feed'>) {
  const { community: slug } = await props.params;
  const { community, membership } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const [suggestions, suggestionStats, myInterests, polls, proposals, members] = await Promise.all([
    supabase
      .from('activity_suggestions')
      .select(
        'id, name, description, expected_participants, status, created_at, memberships(profiles(full_name))',
      )
      .eq('community_id', community.id)
      .in('status', ['new', 'reviewing', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('suggestion_stats')
      .select('suggestion_id, interested')
      .eq('community_id', community.id),
    supabase
      .from('suggestion_interests')
      .select('suggestion_id')
      .eq('membership_id', membership.id),
    supabase
      .from('polls')
      .select('id, question, detail, status, closes_at')
      .eq('community_id', community.id)
      .eq('status', 'voting')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('fund_reallocations')
      .select(
        'id, amount, reason, threshold_pct, status, from_event:events!fund_reallocations_from_event_id_fkey(name), to_event:events!fund_reallocations_to_event_id_fkey(name), to_label',
      )
      .eq('community_id', community.id)
      .in('status', ['voting', 'approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('memberships')
      .select('id, role, profiles(full_name), unit_occupants(units(block, number))')
      .eq('community_id', community.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: false })
      .limit(60),
  ]);

  const interestCounts = new Map(
    (suggestionStats.data ?? []).map((row) => [row.suggestion_id, row.interested ?? 0]),
  );
  const myInterested = new Set((myInterests.data ?? []).map((row) => row.suggestion_id));

  // Poll tallies and my own ballot, fetched separately because the results
  // view aggregates past RLS while my vote is only readable by me.
  const pollIds = (polls.data ?? []).map((poll) => poll.id);
  const [pollResults, myVotes, proposalResults, myProposalVotes] = await Promise.all([
    pollIds.length
      ? supabase
          .from('poll_results')
          .select('poll_id, option_id, label, emoji, votes, total_votes, position')
          .in('poll_id', pollIds)
          .order('position')
      : Promise.resolve({ data: [] as never[] }),
    pollIds.length
      ? supabase
          .from('poll_votes')
          .select('poll_id, option_id')
          .eq('membership_id', membership.id)
          .in('poll_id', pollIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('reallocation_results').select('*').eq('community_id', community.id),
    supabase
      .from('reallocation_votes')
      .select('reallocation_id, approve')
      .eq('membership_id', membership.id),
  ]);

  const myPollVote = new Map((myVotes.data ?? []).map((row) => [row.poll_id, row.option_id]));
  const proposalTally = new Map(
    (proposalResults.data ?? []).map((row) => [row.reallocation_id, row]),
  );
  const myProposalVote = new Map(
    (myProposalVotes.data ?? []).map((row) => [row.reallocation_id, row.approve]),
  );

  return (
    <>
      <PageHeader
        title="Community"
        description={`${community.name} · Society ID ${community.join_code}`}
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            {/* Money proposals first: they expire and they matter most. */}
            {proposals.data?.length ? (
              <section>
                <h2 className="text-ink-soft mb-3 text-sm font-semibold">Decisions</h2>
                <div className="space-y-3">
                  {proposals.data.map((proposal) => {
                    const tally = proposalTally.get(proposal.id);
                    return (
                      <ReallocationCard
                        key={proposal.id}
                        slug={slug}
                        currency={community.currency}
                        myVote={myProposalVote.get(proposal.id) ?? null}
                        proposal={{
                          id: proposal.id,
                          amount: Number(proposal.amount),
                          reason: proposal.reason,
                          fromName: proposal.from_event?.name ?? 'a fund',
                          toName: proposal.to_event?.name ?? proposal.to_label ?? 'another fund',
                          thresholdPct: proposal.threshold_pct,
                          approveVotes: tally?.approve_votes ?? 0,
                          rejectVotes: tally?.reject_votes ?? 0,
                          eligible: tally?.eligible ?? 0,
                          status: proposal.status,
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            {polls.data?.length ? (
              <section>
                <h2 className="text-ink-soft mb-3 text-sm font-semibold">Polls</h2>
                <div className="space-y-3">
                  {polls.data.map((poll) => {
                    const options = (pollResults.data ?? []).filter(
                      (row) => row.poll_id === poll.id,
                    );
                    return (
                      <PollCard
                        key={poll.id}
                        slug={slug}
                        myOptionId={myPollVote.get(poll.id) ?? null}
                        poll={{
                          id: poll.id,
                          question: poll.question,
                          detail: poll.detail,
                          options,
                          totalVotes: options[0]?.total_votes ?? 0,
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="text-ink-soft mb-3 text-sm font-semibold">Ideas from residents</h2>
              {suggestions.data?.length ? (
                <div className="space-y-3">
                  {suggestions.data.map((suggestion) => (
                    <Card key={suggestion.id}>
                      <CardBody>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-ink text-sm font-semibold">💡 {suggestion.name}</p>
                            {suggestion.description ? (
                              <p className="text-ink-muted mt-1 text-sm">
                                {suggestion.description}
                              </p>
                            ) : null}
                            <p className="text-ink-subtle mt-1.5 text-xs">
                              {suggestion.memberships?.profiles?.full_name ?? 'A resident'} ·{' '}
                              {relativeTime(suggestion.created_at)}
                              {suggestion.expected_participants
                                ? ` · ~${suggestion.expected_participants} people`
                                : ''}
                            </p>
                          </div>
                          {suggestion.status === 'accepted' ? (
                            <Badge tone="success">Accepted</Badge>
                          ) : suggestion.status === 'reviewing' ? (
                            <Badge tone="info">Being reviewed</Badge>
                          ) : null}
                        </div>
                        <div className="mt-3">
                          <InterestButton
                            slug={slug}
                            suggestionId={suggestion.id}
                            interested={myInterested.has(suggestion.id)}
                            count={interestCounts.get(suggestion.id) ?? 0}
                          />
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<Lightbulb className="size-6" />}
                    title="No ideas yet"
                    description="Be the first to suggest something for the society."
                  />
                </Card>
              )}
            </section>
          </div>

          <div className="space-y-5">
            <SuggestForm slug={slug} eventId={null} />

            <Card>
              <CardHeader
                title="Neighbours"
                description={`${members.data?.length ?? 0} active members`}
              />
              {members.data?.length ? (
                <ul className="divide-border-base max-h-96 divide-y overflow-y-auto">
                  {members.data.map((member) => {
                    const units = member.unit_occupants
                      .map((occupant) => (occupant.units ? unitLabel(occupant.units) : null))
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <li key={member.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="bg-surface-sunken text-ink grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
                          {(member.profiles?.full_name ?? '?').slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-ink block truncate text-sm">
                            {member.profiles?.full_name ?? 'Resident'}
                          </span>
                          <span className="text-ink-subtle block truncate text-xs">
                            {units || '—'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<Users className="size-6" />} title="No members yet" />
              )}
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
