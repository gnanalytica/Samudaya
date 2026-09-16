import { Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { SuggestionRow } from '@/lib/events';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { FundBar } from '@/components/badges';
import { decideSuggestion } from '@/app/app/[community]/admin/events/actions';
import { voteOnSuggestion } from '@/app/app/[community]/events/actions';

/**
 * A suggestion's three stages, on one board: open for voting, with the
 * committee, and not taken forward.
 *
 * The middle stage is the point. Before it existed a suggestion vanished the
 * moment it was sent — the person who made it saw "Nothing to vote on yet",
 * and the committee only found it by opening the To do queue. Now everybody
 * sees what is waiting, and whoever may open it for voting can do so here.
 *
 * The same board serves an event and the society itself; `eventSlug` is the
 * only difference, and it is only used to send the reader back to the right
 * page after a vote.
 */
export function SuggestionBoard({
  slug,
  eventSlug,
  rows,
  myMembershipId,
  canVote,
  canApprove,
  emptyDescription,
}: {
  slug: string;
  /** Absent for the society's own suggestions. */
  eventSlug?: string;
  rows: SuggestionRow[];
  myMembershipId: string;
  canVote: boolean;
  canApprove: boolean;
  /** Shown when nothing is open for voting and nothing is waiting either. */
  emptyDescription: string;
}) {
  const voting = rows.filter((row) => row.status === 'accepted');
  const waiting = rows.filter((row) => row.status === 'new');
  const declined = rows.filter(
    (row) => row.suggested_by === myMembershipId && row.status === 'declined',
  );

  const who = (row: SuggestionRow) =>
    row.suggested_by === myMembershipId
      ? 'you'
      : (row.memberships?.profiles?.full_name ?? 'a resident');

  const kind = (row: SuggestionRow) => (row.kind === 'idea' ? 'Idea' : 'Activity');

  return (
    <div className="space-y-3">
      {voting.length ? (
        voting.map((row) => {
          const total = row.votesFor + row.votesAgainst;
          const forPct = total ? Math.round((row.votesFor / total) * 100) : 0;
          return (
            <Card key={row.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-semibold">{row.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {kind(row)} suggested by {who(row)}
                    </p>
                    {row.description ? (
                      <p className="text-ink-muted mt-1.5 text-sm">{row.description}</p>
                    ) : null}
                  </div>
                  <Badge tone="success">Voting</Badge>
                </div>
                <div className="mt-3">
                  <div className="text-ink-muted mb-1 flex justify-between text-xs font-medium">
                    <span>
                      {row.votesFor} for · {row.votesAgainst} against
                    </span>
                    <span>{total ? `${forPct}% in favour` : 'No votes yet'}</span>
                  </div>
                  <FundBar percent={forPct} />
                </div>
                {canVote ? (
                  <form
                    action={voteOnSuggestion}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    {eventSlug ? <input type="hidden" name="event" value={eventSlug} /> : null}
                    <input type="hidden" name="suggestion_id" value={row.id} />
                    <Button
                      type="submit"
                      name="support"
                      value="1"
                      size="sm"
                      variant={row.myVote === true ? 'primary' : 'secondary'}
                      aria-pressed={row.myVote === true}
                    >
                      <ThumbsUp className="size-4" aria-hidden="true" />
                      For
                    </Button>
                    <Button
                      type="submit"
                      name="support"
                      value="0"
                      size="sm"
                      variant={row.myVote === false ? 'primary' : 'secondary'}
                      aria-pressed={row.myVote === false}
                    >
                      <ThumbsDown className="size-4" aria-hidden="true" />
                      Against
                    </Button>
                    {row.myVote !== null ? (
                      <Button type="submit" name="withdraw" value="1" size="sm" variant="ghost">
                        Withdraw vote
                      </Button>
                    ) : null}
                  </form>
                ) : null}
              </CardBody>
            </Card>
          );
        })
      ) : (
        <Card>
          <EmptyState
            icon={<Lightbulb className="size-6" />}
            title="Nothing to vote on yet"
            description={
              waiting.length
                ? canApprove
                  ? `${waiting.length} ${waiting.length === 1 ? 'suggestion is' : 'suggestions are'} waiting on you, just below.`
                  : `${waiting.length} ${waiting.length === 1 ? 'suggestion is' : 'suggestions are'} with the committee. Once opened, ${waiting.length === 1 ? 'it lands' : 'they land'} here to vote on.`
                : emptyDescription
            }
          />
        </Card>
      )}

      {waiting.length ? (
        <Card>
          <CardHeader
            title="With the committee"
            description={
              canApprove
                ? 'Open one for voting and every resident can have their say on it.'
                : 'Suggested by residents, waiting for the committee to open them for voting.'
            }
          />
          <ul className="divide-border-base divide-y">
            {waiting.map((row) => (
              <li key={row.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">{row.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {kind(row)} suggested by {who(row)}
                    </p>
                    {row.description ? (
                      <p className="text-ink-muted mt-1.5 text-sm">{row.description}</p>
                    ) : null}
                  </div>
                  <Badge tone="warning">Waiting</Badge>
                </div>
                {canApprove ? (
                  <form action={decideSuggestion} className="mt-3 space-y-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="suggestion_id" value={row.id} />
                    <label htmlFor={`sg-note-${row.id}`} className="sr-only">
                      Note for the resident
                    </label>
                    <Input
                      id={`sg-note-${row.id}`}
                      name="note"
                      placeholder="Note for the resident (optional)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" name="approve" value="1" size="sm">
                        Open for voting
                      </Button>
                      <Button type="submit" name="approve" value="0" size="sm" variant="ghost">
                        Decline
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {declined.length ? (
        <Card>
          <CardHeader title="Not taken forward" />
          <ul className="divide-border-base divide-y">
            {declined.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm">{row.name}</p>
                  {row.review_note ? (
                    <p className="text-ink-subtle text-xs">“{row.review_note}”</p>
                  ) : null}
                </div>
                <Badge tone="neutral">Declined</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
