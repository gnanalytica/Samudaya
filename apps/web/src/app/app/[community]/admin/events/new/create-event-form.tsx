'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { ChevronDown, Plus, X } from 'lucide-react';
import {
  COPY,
  DEFAULT_FUND_RULE,
  formatMoney,
  type FundRule,
  FUND_RULES,
  FUND_RULE_LABEL,
} from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE } from '@/lib/action-state';
import { CatalogueSelect } from '@/components/catalogue-select';
import type { Pickers } from '../[event]/forms';
import { createEvent, type EventFormState } from '../actions';

/** What happens to money left over, in plain words shared with the app. */
const FUND_RULE_OPTIONS = FUND_RULES.map((value) => ({ value, label: FUND_RULE_LABEL[value] }));

function Buttons() {
  const { pending, data } = useFormStatus();
  const intent = data?.get('intent');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Save for later comes first, so pressing Enter in a field never publishes. */}
        <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>
          {pending && intent !== 'publish' ? 'Saving…' : COPY.saveForLater}
        </Button>
        <Button type="submit" name="intent" value="publish" disabled={pending}>
          {pending && intent === 'publish' ? 'Publishing…' : COPY.publish}
        </Button>
      </div>
      <p className="text-ink-subtle text-xs">{COPY.publishHint}</p>
    </div>
  );
}

function MoreOptions({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-border-base rounded-lg border">
      <summary className="text-ink flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="text-ink-subtle size-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-border-base space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

type Line = { key: number; categoryId: string | null; amount: string };
type ActivityRow = { key: number; typeId: string; name: string; emoji: string };

export function CreateEventForm({
  slug,
  pickers,
  societyName,
}: {
  slug: string;
  pickers: Pickers;
  societyName: string;
}) {
  const [state, action] = useActionState<EventFormState, FormData>(createEvent, EMPTY_STATE);
  const [emoji, setEmoji] = useState('🎉');
  // Start with the society's first three budget categories; each row keeps a
  // stable key so removing one does not shuffle the others' choices.
  const [lines, setLines] = useState<Line[]>(() =>
    pickers.budget_category
      .slice(0, 3)
      .map((item, key) => ({ key, categoryId: item.id, amount: '' })),
  );
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [nextKey, setNextKey] = useState(3);
  const total = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  const updateActivity = (key: number, patch: Partial<ActivityRow>) =>
    setActivities((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="emoji" value={emoji} />

      <Card>
        <CardHeader title="The event" />
        <CardBody className="space-y-4">
          <Field label="Name" htmlFor="ne-name" error={state.fieldErrors?.name} required>
            {(control) => <Input {...control} name="name" placeholder="Diwali 2026" required />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="ne-start" error={state.fieldErrors?.starts_on} required>
              {(control) => <Input {...control} name="starts_on" type="date" required />}
            </Field>
            <CatalogueSelect
              slug={slug}
              kind="event_type"
              name="event_type"
              label="Event type"
              items={pickers.event_type}
              placeholder="Choose a type"
              onPick={(item) => {
                if (item?.emoji) setEmoji(item.emoji);
              }}
            />
          </div>
          <CatalogueSelect
            slug={slug}
            kind="venue"
            name="venue"
            label="Venue"
            items={pickers.venue}
            placeholder="Choose a venue"
            manageHref={pickers.manageHref}
          />
          <Field label="Description" htmlFor="ne-desc">
            {(control) => <Textarea {...control} name="description" rows={3} />}
          </Field>

          <MoreOptions title={COPY.moreOptions}>
            <div className="grid gap-4 sm:grid-cols-[5rem_1fr]">
              <Field label="Emoji" htmlFor="ne-emoji" hint="From the type.">
                {(control) => (
                  <Input
                    {...control}
                    value={emoji}
                    onChange={(event) => setEmoji(event.target.value)}
                    maxLength={8}
                    className="text-center"
                  />
                )}
              </Field>
              <Field label="Organised by" htmlFor="ne-org">
                {(control) => (
                  <Input {...control} name="organizer" defaultValue={societyName} maxLength={140} />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ends"
                htmlFor="ne-end"
                error={state.fieldErrors?.ends_on}
                hint="For events longer than a day."
              >
                {(control) => <Input {...control} name="ends_on" type="date" />}
              </Field>
              <Field
                label="Expected attendance"
                htmlFor="ne-attendance"
                error={state.fieldErrors?.expected_attendance}
              >
                {(control) => (
                  <Input {...control} name="expected_attendance" type="number" min={0} />
                )}
              </Field>
            </div>
            <Field
              label="If money is left over"
              htmlFor="ne-fund-rule"
              hint="Decided now, before anyone pays, so nobody argues over a surplus later."
            >
              {(control) => (
                <Select {...control} name="fund_rule" defaultValue={DEFAULT_FUND_RULE}>
                  {FUND_RULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </MoreOptions>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Budget"
          description={`What you plan to spend. The total, ${formatMoney(total)}, becomes the fund target.`}
        />
        <CardBody className="space-y-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <CatalogueSelect
                  slug={slug}
                  kind="budget_category"
                  name="budget_category"
                  label="Budget category"
                  items={pickers.budget_category}
                  defaultId={line.categoryId}
                  placeholder="Choose a category"
                  hideLabel
                />
              </div>
              <label className="sr-only" htmlFor={`bl-amt-${line.key}`}>
                Amount
              </label>
              <Input
                id={`bl-amt-${line.key}`}
                name="budget_amount"
                type="number"
                min={0}
                value={line.amount}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l) =>
                      l.key === line.key ? { ...l, amount: event.target.value } : l,
                    ),
                  )
                }
                placeholder="₹"
                className="w-32"
              />
              <button
                type="button"
                onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                className="text-ink-subtle hover:text-ink p-1.5"
                aria-label="Remove this budget line"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setLines((current) => [...current, { key: nextKey, categoryId: null, amount: '' }]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a line
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Activities"
          description="Things residents can register for. You can add more later."
        />
        <CardBody className="space-y-3">
          {activities.map((row) => (
            <div key={row.key} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="new_activity_emoji" value={row.emoji} />
              <div className="min-w-40 flex-1">
                <Field label="Type" htmlFor={`na-type-${row.key}`}>
                  {(control) => (
                    <Select
                      {...control}
                      name="new_activity_type_id"
                      value={row.typeId}
                      onChange={(event) => {
                        const item = pickers.activity_type.find(
                          (entry) => entry.id === event.target.value,
                        );
                        updateActivity(row.key, {
                          typeId: event.target.value,
                          name: item?.label ?? row.name,
                          emoji: item?.emoji ?? row.emoji,
                        });
                      }}
                    >
                      <option value="">Other</option>
                      {pickers.activity_type.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.emoji ? `${item.emoji} ` : ''}
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div className="min-w-40 flex-1">
                <Field label="Name" htmlFor={`na-name-${row.key}`}>
                  {(control) => (
                    <Input
                      {...control}
                      name="new_activity_name"
                      value={row.name}
                      onChange={(event) => updateActivity(row.key, { name: event.target.value })}
                      placeholder="Kids’ rangoli contest"
                      maxLength={140}
                    />
                  )}
                </Field>
              </div>
              <button
                type="button"
                onClick={() =>
                  setActivities((current) => current.filter((item) => item.key !== row.key))
                }
                className="text-ink-subtle hover:text-ink mb-1.5 p-1.5"
                aria-label="Remove this activity"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setActivities((current) => [
                ...current,
                { key: nextKey, typeId: '', name: '', emoji: '🎭' },
              ]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add an activity
          </Button>
        </CardBody>
      </Card>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state.fieldErrors?.ends_on || state.fieldErrors?.expected_attendance ? (
        <p role="alert" className="text-danger text-sm">
          Check the fields under {COPY.moreOptions}.
        </p>
      ) : null}
      <Buttons />
    </form>
  );
}
