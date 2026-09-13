'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Clock, ExternalLink, Smartphone } from 'lucide-react';
import { formatMoney, upiNote, upiPayUri } from '@samudaya/core';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/card';
import { FileUpload } from '@/components/file-upload';
import { contribute, type ContributeState } from '../../actions';

const PRESETS = [500, 1001, 2001, 5001];

const initial: ContributeState = {};

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? 'Sending…' : 'I’ve paid — send for confirmation'}
    </Button>
  );
}

export function ContributeForm({
  slug,
  eventSlug,
  eventName,
  currency,
  suggested,
  upi,
  flatLabel,
  proofFolder,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  currency: string;
  /** Pre-filled from a link like ?amount=2000. */
  suggested: number | null;
  upi: { vpa: string; payeeName: string };
  flatLabel: string | null;
  /** `{community_id}/{membership_id}`, where this resident's screenshots go. */
  proofFolder: string;
}) {
  const [state, action] = useActionState(contribute, initial);
  const [amount, setAmount] = useState<number | null>(suggested);
  const [custom, setCustom] = useState(
    suggested && !PRESETS.includes(suggested) ? String(suggested) : '',
  );
  const [step, setStep] = useState<'amount' | 'pay'>('amount');
  const [uploading, setUploading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const note = upiNote(flatLabel, eventName);
  const uri = useMemo(
    () => (amount ? upiPayUri({ vpa: upi.vpa, payeeName: upi.payeeName, amount, note }) : null),
    [amount, note, upi.vpa, upi.payeeName],
  );

  useEffect(() => {
    let cancelled = false;
    if (!uri || step !== 'pay') return;
    QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, step]);

  if (state.reported) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <Clock className="text-warning mx-auto size-12" aria-hidden="true" />
          <h2 className="text-ink mt-4 text-xl font-semibold tracking-tight">
            Sent for confirmation
          </h2>
          <p className="text-ink-muted mx-auto mt-1 max-w-sm text-sm">
            Staff will match UPI reference{' '}
            <span className="text-ink font-mono">{state.reported.reference}</span> with the bank
            statement. Your {formatMoney(state.reported.amount, currency)} counts towards{' '}
            {eventName} once it is confirmed.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <ButtonLink href={`/app/${slug}/me`} variant="secondary" size="sm">
              My payments
            </ButtonLink>
            <ButtonLink href={`/app/${slug}/events/${eventSlug}`} size="sm">
              Back to the event
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (step === 'amount') {
    return (
      <Card>
        <CardBody className="space-y-5">
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

          <Field label="Or another amount" htmlFor="custom-amount">
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

          <Button
            type="button"
            className="w-full"
            disabled={!amount}
            onClick={() => setStep('pay')}
          >
            {amount ? `Pay ${formatMoney(amount, currency)} with UPI` : 'Choose an amount'}
          </Button>
          <p className="text-ink-subtle text-center text-xs">
            You pay {upi.payeeName} directly from your UPI app. Samudaya never handles the money.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <button
          type="button"
          onClick={() => setStep('amount')}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Change amount
        </button>

        <section className="space-y-3">
          <h2 className="text-ink text-base font-semibold">
            1. Pay {formatMoney(amount ?? 0, currency)} to {upi.payeeName}
          </h2>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {qr ? (
              // A data URL generated in the browser; next/image adds nothing here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt={`UPI QR code to pay ${upi.payeeName}`}
                width={180}
                height={180}
                className="border-border-base rounded-lg border bg-white p-1"
              />
            ) : null}
            <div className="w-full space-y-3 text-sm">
              {uri ? (
                <a
                  href={uri}
                  className="bg-accent text-accent-ink inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold sm:w-auto"
                >
                  <Smartphone className="size-4" aria-hidden="true" />
                  Open my UPI app
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              <p className="text-ink-muted">
                On a computer, scan the QR code with your phone. Or pay manually to{' '}
                <span className="text-ink font-mono">{upi.vpa}</span> with the note{' '}
                <span className="text-ink font-mono">{note}</span>.
              </p>
            </div>
          </div>
        </section>

        <form action={action} className="space-y-4">
          <h2 className="text-ink text-base font-semibold">2. Tell us it’s done</h2>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event" value={eventSlug} />
          <input type="hidden" name="amount" value={amount ?? ''} />

          <Field
            label="UPI reference"
            htmlFor="upi-reference"
            error={state.fieldErrors?.reference}
            hint="The 12-digit UTR or transaction ID shown in your UPI app after paying."
            required
          >
            {(control) => (
              <Input
                {...control}
                name="reference"
                inputMode="numeric"
                autoComplete="off"
                placeholder="612345678901"
                required
              />
            )}
          </Field>

          <FileUpload
            bucket="payment-proofs"
            folder={proofFolder}
            name="proof_path"
            label="Payment screenshot (optional)"
            hint="Helps staff confirm faster. Only you and staff can see it."
            maxBytes={5 * 1_048_576}
            onUploadingChange={setUploading}
          />

          {state.fieldErrors?.amount ? (
            <p role="alert" className="text-danger text-sm">
              {state.fieldErrors.amount}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}

          <Submit disabled={uploading} />
          <p className="text-ink-subtle text-center text-xs">
            Your payment shows as waiting until staff confirm it against the bank statement.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
