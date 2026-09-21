'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Lightbulb, ThumbsUp } from 'lucide-react';
import { formatMoney } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { suggestActivity, toggleSuggestionInterest, votePoll } from '../events/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function SuggestForm({ slug, eventId }: { slug: string; eventId: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(suggestActivity, EMPTY_STATE);

  return (
    <Card id="suggest" className="scroll-mt-20">
      <CardHeader
        title="Suggest something"
        description="Ideas go to the committee. Your neighbours can back them here."
      />
      <CardBody>
        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          {eventId ? <input type="hidden" name="event_id" value={eventId} /> : null}

          <Field label="Your idea" htmlFor="suggest-name" error={state.fieldErrors?.name} required>
            {(control) => (
              <Input {...control} name="name" placeholder="Weekend badminton tournament" required />
            )}
          </Field>

          <Field label="Tell us more" htmlFor="suggest-desc" error={state.fieldErrors?.description}>
            {(control) => (
              <Textarea
                {...control}
                name="description"
                rows={3}
                placeholder="What would it involve? Who is it for?"
              />
            )}
          </Field>

          <Field
            label="How many people might join?"
            htmlFor="suggest-count"
            error={state.fieldErrors?.expected_participants}
          >
            {(control) => (
              <Input
                {...control}
                name="expected_participants"
                type="number"
                min={0}
                placeholder="20"
              />
            )}
          </Field>

          <label className="text-ink flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="wants_to_coordinate"
              className="border-border-strong size-4 rounded"
            />
            I’d be happy to coordinate it
          </label>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-success text-sm">
              {state.success}
            </p>
          ) : null}

          <Submit label="Send to the committee" busy="Sending…" />
        </form>
      </CardBody>
    </Card>
  );
}

export function InterestButton({
  slug,
  suggestionId,
  interested,
  count,
}: {
  slug: string;
  suggestionId: string;
  interested: boolean;
  count: number;
}) {
  return (
    <form action={toggleSuggestionInterest}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <input type="hidden" name="interested" value={interested ? '1' : '0'} />
      <button
        type="submit"
        aria-pressed={interested}
        className={
          interested
            ? 'border-accent bg-brand-50 text-accent dark:bg-brand-950 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold'
            : 'border-border-base bg-surface-raised text-ink-muted hover:bg-surface-sunken inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium'
        }
      >
        {interested ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <ThumbsUp className="size-3.5" aria-hidden="true" />
        )}
        {count} interested
      </button>
    </form>
  );
}

export function PollCard({
  slug,
  poll,
  myOptionId,
}: {
  slug: string;
  poll: {
    id: string;
    question: string;
    detail: string | null;
    options: {
      option_id: string | null;
      label: string | null;
      emoji: string | null;
      votes: number | null;
    }[];
    totalVotes: number;
  };
  myOptionId: string | null;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-ink text-sm font-semibold">🗳️ {poll.question}</p>
        {poll.detail ? <p className="text-ink-muted mt-1 text-sm">{poll.detail}</p> : null}

        <div className="mt-3 space-y-2">
          {poll.options.map((option) => {
            const votes = option.votes ?? 0;
            const share = poll.totalVotes > 0 ? Math.round((votes / poll.totalVotes) * 100) : 0;
            const mine = option.option_id === myOptionId;
            return (
              <form key={option.option_id} action={votePoll}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="poll_id" value={poll.id} />
                <input type="hidden" name="option_id" value={option.option_id ?? ''} />
                <button
                  type="submit"
                  aria-pressed={mine}
                  className="border-border-base bg-surface-raised hover:bg-surface-sunken w-full rounded-lg border p-2.5 text-left"
                >
                  <span className="flex items-center justify-between text-sm">
                    <span className={mine ? 'text-ink font-semibold' : 'text-ink-muted'}>
                      {option.emoji ? `${option.emoji} ` : ''}
                      {option.label}
                      {mine ? ' · your vote' : ''}
                    </span>
                    <span className="text-ink-subtle text-xs font-medium">{share}%</span>
                  </span>
                  <span
                    className="bg-surface-sunken mt-1.5 block h-1.5 overflow-hidden rounded-full"
                    aria-hidden="true"
                  >
                    <span
                      className={mine ? 'bg-accent block h-full' : 'bg-border-strong block h-full'}
                      style={{ width: `${share}%` }}
                    />
                  </span>
                </button>
              </form>
            );
          })}
        </div>

        <p className="text-ink-subtle mt-2 text-xs">
          {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'} · your ballot is private
        </p>
      </CardBody>
    </Card>
  );
}

export const SuggestionIcon = Lightbulb;
