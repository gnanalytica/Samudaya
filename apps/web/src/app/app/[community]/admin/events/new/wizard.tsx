'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import {
  DEFAULT_ACTIVITIES,
  DEFAULT_BUDGET_LINES,
  DEFAULT_VOLUNTEER_ROLES,
  FUND_RULES,
  FUND_RULE_LABEL,
  REQUIREMENT_KEYS,
  REQUIREMENT_TASKS,
  formatDate,
  formatMoney,
  tasksForRequirements,
} from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/field';
import { createEventFromWizard, type WizardState } from '../actions';

const STEPS = [
  'Details',
  'Budget',
  'Requirements',
  'Activities',
  'Checklist',
  'Fund rule',
  'Preview',
] as const;

const initial: WizardState = {};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function Publish({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Creating…' : 'Create as draft'}
    </Button>
  );
}

/**
 * The seven-step creation flow.
 *
 * All of it is client state until the final submit: an event is only worth
 * writing once the committee has decided the budget, the checklist and — the
 * one that matters most — what happens to any surplus. The fund rule is
 * chosen here, before a single rupee has been collected.
 */
export function EventWizard({
  communitySlug,
  currency,
}: {
  communitySlug: string;
  currency: string;
}) {
  const [state, action] = useActionState(createEventFromWizard, initial);
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [emoji, setEmoji] = useState('🎉');
  const [startsOn, setStartsOn] = useState('');
  const [venue, setVenue] = useState('');
  const [organizer, setOrganizer] = useState('Society Cultural Committee');
  const [description, setDescription] = useState('');
  const [attendance, setAttendance] = useState('');

  const [budget, setBudget] = useState(DEFAULT_BUDGET_LINES.map((line) => ({ ...line })));
  const [requirements, setRequirements] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(REQUIREMENT_KEYS.map((key) => [key, true])),
  );
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES.map((a) => ({ ...a })));
  const [roles, setRoles] = useState(DEFAULT_VOLUNTEER_ROLES.map((r) => ({ ...r })));
  const [tasks, setTasks] = useState<string[]>([]);
  const [tasksSeeded, setTasksSeeded] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [fundRule, setFundRule] = useState<string>('carry_next_edition');
  const [fundRuleNote, setFundRuleNote] = useState('');

  const fundTarget = useMemo(
    () => budget.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [budget],
  );

  const detailsValid = name.trim().length >= 3 && slug.length >= 2 && startsOn !== '';
  const canAdvance = step !== 0 || detailsValid;

  const goNext = () => {
    // Seed the checklist from the requirements the first time we reach it, so
    // later edits are not overwritten.
    if (step === 3 && !tasksSeeded) {
      setTasks(tasksForRequirements(requirements));
      setTasksSeeded(true);
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const payload = JSON.stringify({
    slug,
    emoji,
    name: name.trim(),
    starts_on: startsOn,
    ends_on: null,
    venue: venue.trim() || undefined,
    organizer: organizer.trim() || undefined,
    description: description.trim() || undefined,
    expected_attendance: attendance ? Number(attendance) : undefined,
    fund_rule: fundRule,
    fund_rule_note:
      fundRuleNote.trim() || FUND_RULE_LABEL[fundRule as keyof typeof FUND_RULE_LABEL],
    budget: budget.filter((line) => line.name.trim() && Number(line.amount) > 0),
    tasks: tasks.filter((task) => task.trim()),
    activities: activities.filter((activity) => activity.name.trim()),
    volunteer_roles: roles.filter((role) => role.name.trim()),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-5 flex gap-1.5" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <span className="sr-only">
              {label}
              {index === step ? ' (current step)' : ''}
            </span>
            <span
              aria-hidden="true"
              className={
                index <= step
                  ? 'bg-accent block h-1.5 rounded-full'
                  : 'bg-border-base block h-1.5 rounded-full'
              }
            />
          </li>
        ))}
      </ol>

      <p className="text-accent text-xs font-semibold tracking-wide uppercase">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="text-ink mt-1 mb-4 text-xl font-semibold tracking-tight">{STEPS[step]}</h2>

      <Card>
        <CardBody className="space-y-4">
          {/* ------------------------------------------------------ details */}
          {step === 0 ? (
            <>
              <Field label="Event name" htmlFor="w-name" error={state.fieldErrors?.name} required>
                {(control) => (
                  <Input
                    {...control}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!slugTouched) setSlug(slugify(event.target.value));
                    }}
                    placeholder="Ganesh Chaturthi 2026"
                  />
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
                <Field label="Emoji" htmlFor="w-emoji">
                  {(control) => (
                    <Input
                      {...control}
                      value={emoji}
                      onChange={(event) => setEmoji(event.target.value)}
                      maxLength={4}
                      className="text-center text-xl"
                    />
                  )}
                </Field>
                <Field
                  label="Web address"
                  htmlFor="w-slug"
                  error={state.fieldErrors?.slug}
                  hint={`/events/${slug || 'your-event'}`}
                  required
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setSlug(slugify(event.target.value));
                      }}
                      placeholder="ganesh-2026"
                    />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" htmlFor="w-date" error={state.fieldErrors?.starts_on} required>
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      value={startsOn}
                      onChange={(event) => setStartsOn(event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Venue" htmlFor="w-venue">
                  {(control) => (
                    <Input
                      {...control}
                      value={venue}
                      onChange={(event) => setVenue(event.target.value)}
                      placeholder="Clubhouse"
                    />
                  )}
                </Field>
              </div>

              <Field label="Organised by" htmlFor="w-organizer">
                {(control) => (
                  <Input
                    {...control}
                    value={organizer}
                    onChange={(event) => setOrganizer(event.target.value)}
                  />
                )}
              </Field>

              <Field label="What is it?" htmlFor="w-desc">
                {(control) => (
                  <Textarea
                    {...control}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ten days of pooja, cultural performances and community meals."
                  />
                )}
              </Field>

              <Field label="Expected attendance" htmlFor="w-att">
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={0}
                    value={attendance}
                    onChange={(event) => setAttendance(event.target.value)}
                    placeholder="200"
                  />
                )}
              </Field>
            </>
          ) : null}

          {/* ------------------------------------------------------- budget */}
          {step === 1 ? (
            <>
              <p className="text-ink-muted text-sm">
                These lines add up to the fund target residents are asked to reach.
              </p>
              {budget.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Budget line ${index + 1} name`}
                    value={line.name}
                    onChange={(event) =>
                      setBudget((lines) =>
                        lines.map((l, i) => (i === index ? { ...l, name: event.target.value } : l)),
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    aria-label={`Budget line ${index + 1} amount`}
                    type="number"
                    min={0}
                    value={line.amount}
                    onChange={(event) =>
                      setBudget((lines) =>
                        lines.map((l, i) =>
                          i === index ? { ...l, amount: Number(event.target.value) || 0 } : l,
                        ),
                      )
                    }
                    className="w-32"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${line.name || 'line'}`}
                    onClick={() => setBudget((lines) => lines.filter((_, i) => i !== index))}
                    className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-2"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setBudget((lines) => [...lines, { name: '', amount: 0 }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add a line
              </Button>
              <div className="bg-surface-sunken flex items-center justify-between rounded-lg px-4 py-3">
                <span className="text-ink text-sm font-medium">Fund target</span>
                <span className="text-ink text-lg font-semibold">
                  {formatMoney(fundTarget, currency)}
                </span>
              </div>
            </>
          ) : null}

          {/* ------------------------------------------------- requirements */}
          {step === 2 ? (
            <>
              <p className="text-ink-muted text-sm">
                What this event needs. Each one you tick adds tasks to the checklist.
              </p>
              {REQUIREMENT_KEYS.map((key) => (
                <label
                  key={key}
                  className="border-border-base flex items-start gap-3 border-b py-2.5 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={requirements[key] ?? false}
                    onChange={() =>
                      setRequirements((current) => ({ ...current, [key]: !current[key] }))
                    }
                    className="border-border-strong mt-0.5 size-4 rounded"
                  />
                  <span>
                    <span className="text-ink block text-sm font-medium">
                      {REQUIREMENT_TASKS[key]!.label}
                    </span>
                    <span className="text-ink-subtle block text-xs">
                      {REQUIREMENT_TASKS[key]!.tasks.length} task
                      {REQUIREMENT_TASKS[key]!.tasks.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </label>
              ))}
            </>
          ) : null}

          {/* --------------------------------------------------- activities */}
          {step === 3 ? (
            <>
              <p className="text-ink-muted text-sm">
                Performances residents can sign up for, and jobs that need hands.
              </p>

              <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                Cultural activities
              </p>
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Activity ${index + 1} emoji`}
                    value={activity.emoji}
                    onChange={(event) =>
                      setActivities((list) =>
                        list.map((a, i) => (i === index ? { ...a, emoji: event.target.value } : a)),
                      )
                    }
                    className="w-16 text-center"
                    maxLength={4}
                  />
                  <Input
                    aria-label={`Activity ${index + 1} name`}
                    value={activity.name}
                    onChange={(event) =>
                      setActivities((list) =>
                        list.map((a, i) => (i === index ? { ...a, name: event.target.value } : a)),
                      )
                    }
                    className="flex-1"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${activity.name || 'activity'}`}
                    onClick={() => setActivities((list) => list.filter((_, i) => i !== index))}
                    className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-2"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActivities((list) => [...list, { name: '', emoji: '🎭' }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add an activity
              </Button>

              <p className="text-ink-subtle mt-4 text-xs font-semibold tracking-wide uppercase">
                Volunteer roles
              </p>
              {roles.map((role, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Role ${index + 1} emoji`}
                    value={role.emoji}
                    onChange={(event) =>
                      setRoles((list) =>
                        list.map((r, i) => (i === index ? { ...r, emoji: event.target.value } : r)),
                      )
                    }
                    className="w-16 text-center"
                    maxLength={4}
                  />
                  <Input
                    aria-label={`Role ${index + 1} name`}
                    value={role.name}
                    onChange={(event) =>
                      setRoles((list) =>
                        list.map((r, i) => (i === index ? { ...r, name: event.target.value } : r)),
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    aria-label={`How many people for ${role.name || 'this role'}`}
                    type="number"
                    min={1}
                    value={role.target}
                    onChange={(event) =>
                      setRoles((list) =>
                        list.map((r, i) =>
                          i === index ? { ...r, target: Number(event.target.value) || 1 } : r,
                        ),
                      )
                    }
                    className="w-20"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${role.name || 'role'}`}
                    onClick={() => setRoles((list) => list.filter((_, i) => i !== index))}
                    className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-2"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRoles((list) => [...list, { name: '', emoji: '🙋', target: 3 }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add a role
              </Button>
            </>
          ) : null}

          {/* ---------------------------------------------------- checklist */}
          {step === 4 ? (
            <>
              <p className="text-ink-muted text-sm">
                Seeded from what you ticked. Edit freely — this is what drives the readiness figure
                residents see.
              </p>
              {tasks.length === 0 ? (
                <p className="text-ink-subtle text-sm">No tasks yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tasks.map((task, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-ink-subtle">
                        ☐
                      </span>
                      <Input
                        aria-label={`Task ${index + 1}`}
                        value={task}
                        onChange={(event) =>
                          setTasks((list) =>
                            list.map((t, i) => (i === index ? event.target.value : t)),
                          )
                        }
                        className="flex-1"
                      />
                      <button
                        type="button"
                        aria-label={`Remove task ${index + 1}`}
                        onClick={() => setTasks((list) => list.filter((_, i) => i !== index))}
                        className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-2"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  aria-label="New task"
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  placeholder="Add another task"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (newTask.trim()) {
                        setTasks((list) => [...list, newTask.trim()]);
                        setNewTask('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (newTask.trim()) {
                      setTasks((list) => [...list, newTask.trim()]);
                      setNewTask('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </>
          ) : null}

          {/* ---------------------------------------------------- fund rule */}
          {step === 5 ? (
            <>
              <p className="text-ink-muted text-sm">
                What happens to money left over when this event closes. Decided now, before anybody
                contributes — moving funds later takes a resident vote.
              </p>
              {FUND_RULES.map((rule) => (
                <button
                  key={rule}
                  type="button"
                  aria-pressed={fundRule === rule}
                  onClick={() => setFundRule(rule)}
                  className={
                    fundRule === rule
                      ? 'border-accent bg-surface-raised text-ink flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left text-sm font-medium'
                      : 'border-border-base bg-surface-raised text-ink-muted hover:bg-surface-sunken flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm'
                  }
                >
                  {FUND_RULE_LABEL[rule]}
                  {fundRule === rule ? (
                    <Check className="text-accent size-4" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
              <Field
                label="How to explain it to residents"
                htmlFor="w-rule-note"
                hint="Shown on the event page and the ledger."
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    value={fundRuleNote}
                    onChange={(event) => setFundRuleNote(event.target.value)}
                    placeholder={FUND_RULE_LABEL[fundRule as keyof typeof FUND_RULE_LABEL]}
                  />
                )}
              </Field>
            </>
          ) : null}

          {/* ------------------------------------------------------ preview */}
          {step === 6 ? (
            <>
              <p className="text-ink-muted text-sm">This is what residents will see.</p>
              <div className="from-brand-700 to-brand-900 rounded-xl bg-gradient-to-br p-5 text-white">
                <div className="text-3xl">{emoji}</div>
                <p className="mt-2 text-lg font-semibold">{name || 'Untitled event'}</p>
                <p className="text-brand-100 mt-0.5 text-sm">
                  {startsOn ? formatDate(startsOn) : 'No date'}
                  {venue ? ` · ${venue}` : ''}
                </p>
                <p className="text-brand-100 mt-3 text-sm">
                  Target {formatMoney(fundTarget, currency)}
                  {attendance ? ` · ~${attendance} attending` : ''}
                </p>
              </div>

              {description ? <p className="text-ink-muted text-sm">{description}</p> : null}

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Checklist</dt>
                  <dd className="text-ink font-medium">{tasks.length} tasks</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Activities</dt>
                  <dd className="text-ink font-medium">
                    {activities.filter((a) => a.name.trim()).length}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Volunteer roles</dt>
                  <dd className="text-ink font-medium">
                    {roles.filter((r) => r.name.trim()).length}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Surplus rule</dt>
                  <dd className="text-ink text-right font-medium">
                    {FUND_RULE_LABEL[fundRule as keyof typeof FUND_RULE_LABEL]}
                  </dd>
                </div>
              </dl>

              <p className="bg-surface-sunken text-ink-muted rounded-lg px-4 py-3 text-xs">
                It will be created as a <span className="text-ink font-medium">draft</span>.
                Residents see nothing and the fund stays closed until an admin publishes it.
              </p>

              {state.error ? (
                <p role="alert" className="text-danger text-sm">
                  {state.error}
                </p>
              ) : null}

              <form action={action}>
                <input type="hidden" name="slug" value={communitySlug} />
                <input type="hidden" name="payload" value={payload} />
                <Publish disabled={!detailsValid} />
              </form>
            </>
          ) : null}
        </CardBody>
      </Card>

      <div className="mt-4 flex justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext} disabled={!canAdvance}>
            Next
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
