'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import QRCode from 'qrcode';
import { Clock, ExternalLink, Smartphone } from 'lucide-react';
import { COPY, formatMoney, upiNote, upiPayUri } from '@samudaya/core';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/card';
import { FileUpload } from '@/components/file-upload';
import { FocusFirstError } from '@/components/focus-first-error';
import { contribute, type ContributeState } from '../../actions';

const PRESETS = [500, 1001, 2001, 5001];

const initial: ContributeState = {};

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? 'Sending…' : 'I’ve paid'}
    </Button>
  );
}

/**
 * Contributing on one screen: pick an amount, pay it from a UPI app (QR code on
 * a computer, a button on a phone), then paste the UPI transaction ID. The
 * payment and the report sit side by side on wide screens and stack on phones.
 */
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
  const [uploading, setUploading] = useState(false);
  const [qr, setQr] = useState<{ uri: string; src: string } | null>(null);

  /**
   * What gets recorded, which is not always what step 1 asked for. The QR code
   * carries an amount, but a UPI app lets you change it, and people do: they
   * round up, they add a neighbour's share, they pay half now. The society's
   * books should say what left the bank, so this field is the one that counts
   * and the resident can overwrite it.
   *
   * It follows step 1 while they are still choosing — picking ₹1,001 and then
   * typing it again would be silly — and stops following the moment they edit
   * it, unless they go back and pick a different amount.
   */
  const [reported, setReported] = useState(suggested ? String(suggested) : '');
  const [followed, setFollowed] = useState(amount);
  if (followed !== amount) {
    setFollowed(amount);
    setReported(amount === null ? '' : String(amount));
  }

  const note = upiNote(flatLabel, eventName);
  const uri = useMemo(
    () => (amount ? upiPayUri({ vpa: upi.vpa, payeeName: upi.payeeName, amount, note }) : null),
    [amount, note, upi.vpa, upi.payeeName],
  );

  useEffect(() => {
    let cancelled = false;
    if (!uri) return;
    QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((src) => {
        if (!cancelled) setQr({ uri, src });
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (state.reported) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <Clock className="text-warning mx-auto size-12" aria-hidden="true" />
          <h2 className="text-ink mt-4 text-xl font-semibold tracking-tight">
            Sent for confirmation
          </h2>
          <p className="text-ink-muted mx-auto mt-1 max-w-sm text-sm">
            Staff will match UPI transaction ID{' '}
            <span className="text-ink font-mono">{state.reported.reference}</span> with the bank
            statement. Your {formatMoney(state.reported.amount, currency)} counts towards{' '}
            {eventName} once it is confirmed.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <ButtonLink href={`/app/${slug}/me`} variant="secondary" size="sm">
              My payments
            </ButtonLink>
            <ButtonLink href={`/app/${slug}/events/${eventSlug}?tab=money`} size="sm">
              Back to the event
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  const qrSrc = qr && qr.uri === uri ? qr.src : null;

  return (
    <Card>
      <CardBody className="space-y-6">
        <fieldset>
          <legend className="text-ink mb-2 block text-sm font-semibold">1. Amount</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="custom-amount" className="sr-only">
                Another amount
              </label>
              <Input
                id="custom-amount"
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                placeholder="Other ₹"
                value={custom}
                onChange={(event) => {
                  setCustom(event.target.value);
                  const parsed = Number.parseInt(event.target.value, 10);
                  setAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                }}
                className="h-full text-center"
              />
            </div>
          </div>
        </fieldset>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3" aria-labelledby="pay-heading">
            <h2 id="pay-heading" className="text-ink text-sm font-semibold">
              2. Pay {amount ? formatMoney(amount, currency) : ''} to {upi.payeeName}
            </h2>
            {uri ? (
              <>
                <div className="flex justify-center md:justify-start">
                  {qrSrc ? (
                    // A data URL generated in the browser; next/image adds nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrSrc}
                      alt={`UPI QR code to pay ${formatMoney(amount ?? 0, currency)} to ${upi.payeeName}`}
                      width={180}
                      height={180}
                      className="border-border-base rounded-lg border bg-white p-1"
                    />
                  ) : (
                    <div className="border-border-base bg-surface-sunken size-[180px] rounded-lg border" />
                  )}
                </div>
                <a
                  href={uri}
                  className="bg-accent text-accent-ink inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                >
                  <Smartphone className="size-4" aria-hidden="true" />
                  Open UPI app
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </>
            ) : (
              <p className="border-border-base bg-surface-sunken text-ink-muted rounded-lg border px-4 py-6 text-center text-sm">
                Choose an amount to see the QR code.
              </p>
            )}
            <dl className="text-ink-muted space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt>UPI ID</dt>
                <dd className="text-ink font-mono break-all">{upi.vpa}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt>Note</dt>
                <dd className="text-ink font-mono break-all">{note}</dd>
              </div>
            </dl>
            {/* Most residents pay from the phone they are reading this on, where
                "scan the QR code with your phone" is nonsense. Branched with CSS
                rather than a viewport check, so the server and the client render
                the same markup. */}
            <p className="text-ink-subtle text-xs">
              <span className="sm:hidden">
                On this phone, tap Open UPI app or copy the UPI ID above.
              </span>
              <span className="hidden sm:inline">
                On a computer, scan the QR code with your phone.
              </span>{' '}
              You pay {upi.payeeName} directly; Samudaya never handles the money.
            </p>
          </section>

          <form action={action} className="space-y-4" aria-labelledby="report-heading">
            <FocusFirstError signal={state} />
            <h2 id="report-heading" className="text-ink text-sm font-semibold">
              3. Tell us it’s done
            </h2>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event" value={eventSlug} />

            <Field
              label="Amount you actually paid"
              htmlFor="paid-amount"
              error={state.fieldErrors?.amount}
              hint={
                amount && reported !== String(amount)
                  ? `The QR code above was for ${formatMoney(amount, currency)}. This is what will be recorded.`
                  : 'Change it if your UPI app sent a different amount.'
              }
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="amount"
                  type="number"
                  min={1}
                  step="1"
                  inputMode="numeric"
                  autoComplete="off"
                  value={reported}
                  onChange={(event) => setReported(event.target.value)}
                />
              )}
            </Field>

            <Field
              label={COPY.upiReference}
              htmlFor="upi-reference"
              error={state.fieldErrors?.reference}
              hint={COPY.upiReferenceHint}
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="reference"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="612345678901"
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

            {state.error ? (
              <p role="alert" className="text-danger text-sm">
                {state.error}
              </p>
            ) : null}

            {/* Only the upload blocks the button. Missing an amount used to
                disable it too, which said nothing about why — the action
                answers that in the same branded style as every other error. */}
            <Submit disabled={uploading} />
            <p className="text-ink-subtle text-center text-xs">
              It shows as waiting until staff confirm it against the bank statement.
            </p>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
