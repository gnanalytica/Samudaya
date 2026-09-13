'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { FileUpload } from '@/components/file-upload';
import { CatalogueSelect, type PickerItem } from '@/components/catalogue-select';
import {
  addActivity,
  addBudgetLine,
  closeEvent,
  correctExpense,
  recordPayment,
  reviewExpense,
  reviewPayment,
  submitExpense,
  updateEventDetails,
  type CloseState,
} from '../actions';

function Submit({
  label,
  busy,
  variant,
  disabled,
}: {
  label: string;
  busy: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}

export function Feedback({ state }: { state: ActionState }) {
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

/**
 * Resets itself after each submission so staff can add several in a row.
 * `version` changes too, for controlled pieces a native reset cannot clear
 * (such as an uploaded file's path).
 */
function useResettingAction(fn: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, action] = useActionState<ActionState, FormData>(fn, EMPTY_STATE);
  const [version, setVersion] = useState(0);
  const ref = useRef<HTMLFormElement>(null);
  const wrapped = async (formData: FormData) => {
    await action(formData);
    ref.current?.reset();
    setVersion((current) => current + 1);
  };
  return { state, action: wrapped, ref, version };
}

/** The catalogue items a form's pickers offer, and where staff can edit them. */
export type Pickers = {
  event_type: PickerItem[];
  venue: PickerItem[];
  budget_category: PickerItem[];
  activity_type: PickerItem[];
  vendor: PickerItem[];
  manageHref: string;
};

function Hidden({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  return (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
    </>
  );
}

export function EventDetailsForm({
  slug,
  event,
  pickers,
}: {
  slug: string;
  pickers: Pickers;
  event: {
    slug: string;
    emoji: string;
    name: string;
    starts_on: string;
    ends_on: string | null;
    venue: string | null;
    venue_id: string | null;
    event_type_id: string | null;
    organizer: string | null;
    description: string | null;
  };
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateEventDetails, EMPTY_STATE);
  return (
    <form action={action} className="space-y-4">
      <Hidden slug={slug} eventSlug={event.slug} />
      <div className="grid gap-4 sm:grid-cols-[5rem_1fr]">
        <Field label="Emoji" htmlFor="ev-emoji">
          {(control) => (
            <Input
              {...control}
              name="emoji"
              defaultValue={event.emoji}
              maxLength={4}
              className="text-center"
            />
          )}
        </Field>
        <Field label="Name" htmlFor="ev-name" error={state.fieldErrors?.name} required>
          {(control) => <Input {...control} name="name" defaultValue={event.name} required />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="ev-start" error={state.fieldErrors?.starts_on} required>
          {(control) => (
            <Input
              {...control}
              name="starts_on"
              type="date"
              defaultValue={event.starts_on}
              required
            />
          )}
        </Field>
        <Field label="Ends" htmlFor="ev-end" error={state.fieldErrors?.ends_on}>
          {(control) => (
            <Input {...control} name="ends_on" type="date" defaultValue={event.ends_on ?? ''} />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogueSelect
          slug={slug}
          kind="event_type"
          name="event_type"
          label="Event type"
          items={pickers.event_type}
          defaultId={event.event_type_id}
          placeholder="Choose a type"
        />
        <CatalogueSelect
          slug={slug}
          kind="venue"
          name="venue"
          label="Venue"
          items={pickers.venue}
          defaultId={event.venue_id}
          defaultLabel={event.venue}
          placeholder="Choose a venue"
          manageHref={pickers.manageHref}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organised by" htmlFor="ev-org">
          {(control) => (
            <Input {...control} name="organizer" defaultValue={event.organizer ?? ''} />
          )}
        </Field>
      </div>
      <Field label="Description" htmlFor="ev-desc">
        {(control) => (
          <Textarea {...control} name="description" defaultValue={event.description ?? ''} />
        )}
      </Field>
      <Feedback state={state} />
      <Submit label="Save details" busy="Saving…" />
    </form>
  );
}

export function AddBudgetLineForm({
  slug,
  eventSlug,
  pickers,
}: {
  slug: string;
  eventSlug: string;
  pickers: Pickers;
}) {
  const { state, action, ref, version } = useResettingAction(addBudgetLine);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <div className="min-w-44 flex-1">
        <CatalogueSelect
          key={version}
          slug={slug}
          kind="budget_category"
          name="category"
          label="Category"
          items={pickers.budget_category}
          error={state.fieldErrors?.category}
          placeholder="Choose a category"
          manageHref={pickers.manageHref}
          required
        />
      </div>
      <div className="w-36">
        <Field label="Amount (₹)" htmlFor="bl-amount" error={state.fieldErrors?.amount}>
          {(control) => (
            <Input {...control} name="amount" type="number" min={0} step="1" required />
          )}
        </Field>
      </div>
      <Submit label="Add line" busy="Adding…" />
      <div className="basis-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AddActivityForm({
  slug,
  eventSlug,
  pickers,
}: {
  slug: string;
  eventSlug: string;
  pickers: Pickers;
}) {
  const { state, action, ref, version } = useResettingAction(addActivity);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎭');
  return (
    <form
      ref={ref}
      action={async (formData) => {
        await action(formData);
        setName('');
        setEmoji('🎭');
      }}
      className="space-y-3"
    >
      <Hidden slug={slug} eventSlug={eventSlug} />
      <CatalogueSelect
        key={version}
        slug={slug}
        kind="activity_type"
        name="activity_type"
        label="Type"
        items={pickers.activity_type}
        placeholder="Choose a type (optional)"
        hint="Picking a type fills in the name and emoji; change the name to suit this event."
        manageHref={pickers.manageHref}
        onPick={(item) => {
          if (!item) return;
          setName(item.label);
          if (item.emoji) setEmoji(item.emoji);
        }}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-20">
          <Field label="Emoji" htmlFor="act-emoji">
            {(control) => (
              <Input
                {...control}
                name="emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                maxLength={8}
                className="text-center"
              />
            )}
          </Field>
        </div>
        <div className="min-w-40 flex-1">
          <Field label="Activity" htmlFor="act-name" error={state.fieldErrors?.name}>
            {(control) => (
              <Input
                {...control}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kids’ rangoli contest"
                required
              />
            )}
          </Field>
        </div>
        <div className="w-28">
          <Field label="Places" htmlFor="act-capacity" hint="Blank = no limit">
            {(control) => <Input {...control} name="capacity" type="number" min={1} />}
          </Field>
        </div>
      </div>
      <Field label="Description" htmlFor="act-desc">
        {(control) => <Textarea {...control} name="description" rows={2} />}
      </Field>
      <Feedback state={state} />
      <Submit label="Add activity" busy="Adding…" />
    </form>
  );
}

type ExpenseDraft = {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  amount: number;
  vendor: string | null;
  vendor_id: string | null;
  paid_by: string | null;
  method: string;
  bill_url: string | null;
  spent_on: string;
};

const METHODS = [
  ['upi', 'UPI'],
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank transfer'],
  ['cheque', 'Cheque'],
  ['card', 'Card'],
  ['netbanking', 'Net banking'],
  ['other', 'Other'],
] as const;

/** Upload a new bill, or correct and re-upload one that is pending or sent back. */
export function ExpenseForm({
  slug,
  eventSlug,
  communityId,
  eventId,
  expense,
  pickers,
}: {
  slug: string;
  eventSlug: string;
  communityId: string;
  eventId: string;
  expense?: ExpenseDraft;
  pickers: Pickers;
}) {
  const [uploading, setUploading] = useState(false);
  const creating = !expense;
  const created = useResettingAction(submitExpense);
  const [corrected, correctAction] = useActionState<ActionState, FormData>(
    correctExpense,
    EMPTY_STATE,
  );
  const state = creating ? created.state : corrected;
  const id = expense?.id ?? 'new';

  return (
    <form
      ref={creating ? created.ref : undefined}
      action={creating ? created.action : correctAction}
      className="space-y-4"
    >
      <Hidden slug={slug} eventSlug={eventSlug} />
      {expense ? <input type="hidden" name="expense_id" value={expense.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What" htmlFor={`ex-name-${id}`} error={state.fieldErrors?.name} required>
          {(control) => (
            <Input
              {...control}
              name="name"
              placeholder="Pandal and stage"
              defaultValue={expense?.name}
              required
            />
          )}
        </Field>
        <Field
          label="Amount (₹)"
          htmlFor={`ex-amount-${id}`}
          error={state.fieldErrors?.amount}
          required
        >
          {(control) => (
            <Input
              {...control}
              name="amount"
              type="number"
              min={1}
              step="1"
              defaultValue={expense?.amount}
              required
            />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogueSelect
          key={creating ? `cat-${created.version}` : `cat-${expense.id}`}
          slug={slug}
          kind="budget_category"
          name="category"
          label="Category"
          items={pickers.budget_category}
          defaultId={expense?.category_id}
          defaultLabel={expense?.category}
          placeholder="Choose a category"
          hint="The same categories as the budget, so planned and spent line up."
          manageHref={pickers.manageHref}
        />
        <CatalogueSelect
          key={creating ? `ven-${created.version}` : `ven-${expense.id}`}
          slug={slug}
          kind="vendor"
          name="vendor"
          label="Vendor"
          items={pickers.vendor}
          defaultId={expense?.vendor_id}
          defaultLabel={expense?.vendor}
          placeholder="Choose a vendor"
          allowQuickAdd
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paid by" htmlFor={`ex-paid-${id}`} hint="If someone is reimbursed.">
          {(control) => <Input {...control} name="paid_by" defaultValue={expense?.paid_by ?? ''} />}
        </Field>
        <Field label="Method" htmlFor={`ex-method-${id}`}>
          {(control) => (
            <Select {...control} name="method" defaultValue={expense?.method ?? 'upi'}>
              {METHODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date" htmlFor={`ex-date-${id}`}>
          {(control) => (
            <Input {...control} name="spent_on" type="date" defaultValue={expense?.spent_on} />
          )}
        </Field>
      </div>
      <FileUpload
        key={creating ? `new-${created.version}` : expense.id}
        bucket="bills"
        folder={`${communityId}/${eventId}`}
        name="bill_url"
        label="Bill"
        hint="A photo or PDF of the bill, up to 10 MB. Residents see it once the committee approves."
        maxBytes={10 * 1_048_576}
        defaultPath={expense?.bill_url}
        onUploadingChange={setUploading}
      />
      <Feedback state={state} />
      <Submit
        label={creating ? 'Upload bill' : 'Save correction'}
        busy={creating ? 'Uploading…' : 'Saving…'}
        disabled={uploading}
      />
    </form>
  );
}

export function ReviewExpenseForm({
  slug,
  eventSlug,
  expenseId,
}: {
  slug: string;
  eventSlug: string;
  expenseId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reviewExpense, EMPTY_STATE);
  return (
    <form action={action} className="space-y-2">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <input type="hidden" name="expense_id" value={expenseId} />
      <label htmlFor={`note-${expenseId}`} className="sr-only">
        Note for staff
      </label>
      <Input
        id={`note-${expenseId}`}
        name="note"
        placeholder="Note (shown to staff when sending back or rejecting)"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approved" size="sm">
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="changes_requested"
          size="sm"
          variant="secondary"
        >
          Ask for changes
        </Button>
        <Button type="submit" name="decision" value="rejected" size="sm" variant="ghost">
          Reject
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Staff confirm a reported UPI payment, or turn it down with a reason. */
export function ReviewPaymentForm({
  slug,
  eventSlug,
  contributionId,
}: {
  slug: string;
  eventSlug: string;
  contributionId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reviewPayment, EMPTY_STATE);
  return (
    <form action={action} className="space-y-2">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <input type="hidden" name="contribution_id" value={contributionId} />
      <label htmlFor={`pay-note-${contributionId}`} className="sr-only">
        Reason, if turning it down
      </label>
      <Input
        id={`pay-note-${contributionId}`}
        name="note"
        placeholder="Reason, if it is not on the bank statement"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="confirm" size="sm">
          Confirm
        </Button>
        <Button type="submit" name="decision" value="reject" size="sm" variant="ghost">
          Turn down
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function RecordPaymentForm({
  slug,
  eventSlug,
  units,
}: {
  slug: string;
  eventSlug: string;
  units: { id: string; label: string }[];
}) {
  const { state, action, ref } = useResettingAction(recordPayment);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Flat" htmlFor="pay-unit" error={state.fieldErrors?.unit_id} required>
          {(control) => (
            <Select {...control} name="unit_id" defaultValue="" required>
              <option value="" disabled>
                Pick a flat
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount (₹)" htmlFor="pay-amount" error={state.fieldErrors?.amount} required>
          {(control) => (
            <Input {...control} name="amount" type="number" min={1} step="1" required />
          )}
        </Field>
        <Field label="Received on" htmlFor="pay-date" error={state.fieldErrors?.paid_on}>
          {(control) => <Input {...control} name="paid_on" type="date" defaultValue={today} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method" htmlFor="pay-method">
          {(control) => (
            <Select {...control} name="method" defaultValue="cash">
              {METHODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reference" htmlFor="pay-ref" hint="UPI reference, cheque or receipt number.">
          {(control) => <Input {...control} name="reference" />}
        </Field>
      </div>
      <Feedback state={state} />
      <Submit label="Record payment" busy="Recording…" />
    </form>
  );
}

const closeInitial: CloseState = {};

export function CloseEventForm({
  slug,
  eventSlug,
  eventName,
  openBills,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  openBills: number;
}) {
  const [state, action] = useActionState(closeEvent, closeInitial);
  return (
    <Card className="border-danger/40">
      <CardHeader
        title="Close the event"
        description="Publishes the final accounts and freezes the ledger. This cannot be undone."
      />
      <CardBody>
        {openBills > 0 ? (
          <p className="bg-warning/10 text-warning mb-3 rounded-lg px-4 py-3 text-sm">
            {openBills} bill{openBills === 1 ? '' : 's'} still awaiting a decision. Decide on them
            first.
          </p>
        ) : null}
        <form action={action} className="space-y-3">
          <Hidden slug={slug} eventSlug={eventSlug} />
          <Field
            label={`Type “${eventName}” to confirm`}
            htmlFor="close-confirm"
            error={state.fieldErrors?.confirm_name}
          >
            {(control) => <Input {...control} name="confirm_name" autoComplete="off" />}
          </Field>
          <Feedback state={state} />
          <Submit label="Close and publish accounts" busy="Closing…" variant="danger" />
        </form>
      </CardBody>
    </Card>
  );
}
