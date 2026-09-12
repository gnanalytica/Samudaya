'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import {
  addActivity,
  addTask,
  addVolunteerRole,
  closeEvent,
  submitExpense,
  type CloseState,
} from '../actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-danger text-sm">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

/** Resets itself on success so the committee can add several in a row. */
function useResettingAction(fn: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, action] = useActionState<ActionState, FormData>(fn, EMPTY_STATE);
  const ref = useRef<HTMLFormElement>(null);
  const wrapped = async (formData: FormData) => {
    await action(formData);
    ref.current?.reset();
  };
  return { state, action: wrapped, ref };
}

export function AddTaskForm({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  const { state, action, ref } = useResettingAction(addTask);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <div className="min-w-48 flex-1">
        <Field label="New task" htmlFor="task-name" error={state.fieldErrors?.name}>
          {(control) => <Input {...control} name="name" placeholder="Book the sound system" />}
        </Field>
      </div>
      <div className="w-40">
        <Field label="Due" htmlFor="task-due">
          {(control) => <Input {...control} name="due_on" type="date" />}
        </Field>
      </div>
      <Submit label="Add" busy="Adding…" />
      <Feedback state={state} />
    </form>
  );
}

export function AddExpenseForm({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  const { state, action, ref } = useResettingAction(submitExpense);
  return (
    <Card>
      <CardHeader
        title="Record an expense"
        description="It stays out of the resident ledger until an admin approves it — and nobody can approve their own."
      />
      <CardBody>
        <form ref={ref} action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event" value={eventSlug} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What" htmlFor="ex-name" error={state.fieldErrors?.name} required>
              {(control) => <Input {...control} name="name" placeholder="Sound system" required />}
            </Field>
            <Field label="Amount" htmlFor="ex-amount" error={state.fieldErrors?.amount} required>
              {(control) => (
                <Input {...control} name="amount" type="number" min={1} step="1" required />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vendor" htmlFor="ex-vendor">
              {(control) => <Input {...control} name="vendor" placeholder="Beat Box Audio" />}
            </Field>
            <Field label="Category" htmlFor="ex-category">
              {(control) => <Input {...control} name="category" placeholder="sound" />}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid by" htmlFor="ex-paidby" hint="If someone is being reimbursed.">
              {(control) => <Input {...control} name="paid_by" placeholder="Ravi" />}
            </Field>
            <Field label="Spent on" htmlFor="ex-date">
              {(control) => <Input {...control} name="spent_on" type="date" />}
            </Field>
          </div>

          <Field
            label="Bill"
            htmlFor="ex-bill"
            hint="Path of the uploaded bill. Residents can open it from the ledger."
          >
            {(control) => (
              <Input {...control} name="bill_url" placeholder="bills/beatbox-invoice.pdf" />
            )}
          </Field>

          <Feedback state={state} />
          <Submit label="Submit for approval" busy="Submitting…" />
        </form>
      </CardBody>
    </Card>
  );
}

export function AddActivityForm({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  const { state, action, ref } = useResettingAction(addActivity);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <div className="w-20">
        <Field label="Emoji" htmlFor="act-emoji">
          {(control) => (
            <Input
              {...control}
              name="emoji"
              defaultValue="🎭"
              maxLength={4}
              className="text-center"
            />
          )}
        </Field>
      </div>
      <div className="min-w-40 flex-1">
        <Field label="Activity" htmlFor="act-name" error={state.fieldErrors?.name}>
          {(control) => <Input {...control} name="name" placeholder="Open mic" />}
        </Field>
      </div>
      <Submit label="Add" busy="Adding…" />
      <Feedback state={state} />
    </form>
  );
}

export function AddRoleForm({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  const { state, action, ref } = useResettingAction(addVolunteerRole);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <div className="w-20">
        <Field label="Emoji" htmlFor="role-emoji">
          {(control) => (
            <Input
              {...control}
              name="emoji"
              defaultValue="🙋"
              maxLength={4}
              className="text-center"
            />
          )}
        </Field>
      </div>
      <div className="min-w-40 flex-1">
        <Field label="Role" htmlFor="role-name" error={state.fieldErrors?.name}>
          {(control) => <Input {...control} name="name" placeholder="Cleanup" />}
        </Field>
      </div>
      <div className="w-24">
        <Field label="How many" htmlFor="role-target">
          {(control) => (
            <Input {...control} name="target_count" type="number" min={1} defaultValue={3} />
          )}
        </Field>
      </div>
      <Submit label="Add" busy="Adding…" />
      <Feedback state={state} />
    </form>
  );
}

const closeInitial: CloseState = {};

export function CloseEventForm({
  slug,
  eventSlug,
  eventName,
  pendingExpenses,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  pendingExpenses: number;
}) {
  const [state, action] = useActionState(closeEvent, closeInitial);

  return (
    <Card className="border-danger/40">
      <CardHeader
        title="Close the event"
        description="Publishes the transparency report and freezes the ledger. This cannot be undone."
      />
      <CardBody>
        {pendingExpenses > 0 ? (
          <p className="bg-warning/10 text-warning mb-3 rounded-lg px-4 py-3 text-sm">
            {pendingExpenses} expense{pendingExpenses === 1 ? '' : 's'} still awaiting a decision.
            Approve or reject them first.
          </p>
        ) : null}

        <form action={action} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event" value={eventSlug} />
          <Field
            label={`Type “${eventName}” to confirm`}
            htmlFor="close-confirm"
            error={state.fieldErrors?.confirm_name}
          >
            {(control) => <Input {...control} name="confirm_name" autoComplete="off" />}
          </Field>
          <Feedback state={state} />
          <Button type="submit" variant="danger" size="sm" disabled={pendingExpenses > 0}>
            Close and publish the report
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function ExpenseNoteField() {
  return (
    <Field label="Note" htmlFor="review-note" hint="Shown to whoever submitted it.">
      {(control) => <Textarea {...control} name="note" rows={2} />}
    </Field>
  );
}

export { Select };
