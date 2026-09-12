'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2, CreditCard, Landmark, Smartphone } from 'lucide-react';
import { formatMoney, receiptRef } from '@samudaya/core';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/card';
import { contribute, type ContributeState } from '../../actions';

const PRESETS = [500, 1000, 2000, 5000];

const METHODS = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'netbanking', label: 'Net banking', icon: Landmark },
] as const;

const initial: ContributeState = {};

function Submit({ amount, currency }: { amount: number | null; currency: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !amount} className="w-full">
      {pending
        ? 'Recording…'
        : amount
          ? `Contribute ${formatMoney(amount, currency)}`
          : 'Choose an amount'}
    </Button>
  );
}

export function ContributeForm({
  slug,
  eventSlug,
  eventName,
  currency,
  suggested,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  currency: string;
  /** Pre-filled from a WhatsApp link like ?amount=2000. */
  suggested: number | null;
}) {
  const [state, action] = useActionState(contribute, initial);
  const [amount, setAmount] = useState<number | null>(suggested);
  const [custom, setCustom] = useState(
    suggested && !PRESETS.includes(suggested) ? String(suggested) : '',
  );
  const [method, setMethod] = useState<string>('upi');

  if (state.receipt) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <CheckCircle2 className="text-success mx-auto size-12" aria-hidden="true" />
          <h2 className="text-ink mt-4 text-xl font-semibold tracking-tight">Thank you</h2>
          <p className="text-ink-muted mt-1 text-sm">
            Your contribution to {eventName} has been recorded.
          </p>
          <p className="text-success mt-5 text-3xl font-semibold tracking-tight">
            {formatMoney(state.amount ?? 0, currency)}
          </p>
          <p className="text-ink-subtle mt-3 text-xs">
            Receipt
            <br />
            <span className="text-ink font-mono text-sm">
              {receiptRef(eventSlug, state.receipt)}
            </span>
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <ButtonLink
              href={`/app/${slug}/events/${eventSlug}/accounts`}
              variant="secondary"
              size="sm"
            >
              See where it goes
            </ButtonLink>
            <ButtonLink href={`/app/${slug}/events/${eventSlug}`} size="sm">
              Back to the event
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-5">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event" value={eventSlug} />
          <input type="hidden" name="amount" value={amount ?? ''} />
          <input type="hidden" name="method" value={method} />

          <fieldset>
            <legend className="text-ink mb-2 block text-sm font-medium">Amount</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={amount === preset && custom === ''}
                  onClick={() => {
                    setAmount(preset);
                    setCustom('');
                  }}
                  className={
                    amount === preset && custom === ''
                      ? 'border-accent bg-surface-raised text-ink rounded-lg border-2 py-3 text-sm font-semibold'
                      : 'border-border-base bg-surface-raised text-ink-muted hover:bg-surface-sunken rounded-lg border py-3 text-sm font-medium'
                  }
                >
                  {formatMoney(preset, currency)}
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label="Or another amount"
            htmlFor="custom-amount"
            error={state.fieldErrors?.amount}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                placeholder="Enter an amount"
                value={custom}
                onChange={(event) => {
                  setCustom(event.target.value);
                  const parsed = Number.parseInt(event.target.value, 10);
                  setAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                }}
              />
            )}
          </Field>

          <fieldset>
            <legend className="text-ink mb-2 block text-sm font-medium">Payment method</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  onClick={() => setMethod(value)}
                  className={
                    method === value
                      ? 'border-accent bg-surface-raised text-ink flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold'
                      : 'border-border-base bg-surface-raised text-ink-muted hover:bg-surface-sunken flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm'
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}

          <Submit amount={amount} currency={currency} />

          <p className="text-ink-subtle text-center text-xs">
            Every rupee is accounted for in the{' '}
            <Link
              href={`/app/${slug}/events/${eventSlug}/accounts`}
              className="underline underline-offset-4"
            >
              public ledger
            </Link>
            .
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
