'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Clock, Ticket } from 'lucide-react';
import { ROLE_LABEL, formatInviteCode, unitLabel } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import {
  checkInviteCode,
  findCommunity,
  redeemInviteCode,
  submitJoinRequest,
  type InviteState,
  type LookupState,
  type RequestState,
} from './actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

const lookupInitial: LookupState = {};
const requestInitial: RequestState = {};
const inviteInitial: InviteState = {};

/**
 * The Society ID path: find the society, pick a flat, ask to join, wait for
 * the admin. Three short steps rather than one long form, because the middle
 * step needs the society's flat list to exist first.
 */
function SocietyIdFlow() {
  const [lookup, lookupAction] = useActionState(findCommunity, lookupInitial);
  const [request, requestAction] = useActionState(submitJoinRequest, requestInitial);
  const [code, setCode] = useState('');

  if (request.submitted) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <Clock className="text-accent mx-auto size-10" aria-hidden="true" />
          <h2 className="text-ink mt-4 text-lg font-semibold tracking-tight">Request sent</h2>
          <p className="text-ink-muted mt-1 text-sm">
            Your request to join {request.submitted.communityName} is with the society admin. You’ll
            get in as soon as they approve it.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (lookup.community) {
    return (
      <form action={requestAction} className="space-y-4">
        <input type="hidden" name="join_code" value={lookup.community.joinCode} />

        <div className="border-border-base bg-surface-sunken rounded-xl border p-4">
          <p className="text-ink-subtle text-xs tracking-wide uppercase">Joining</p>
          <p className="text-ink mt-1 text-lg font-semibold tracking-tight">
            {lookup.community.name}
          </p>
        </div>

        <Field label="Your name" htmlFor="jr-name" error={request.fieldErrors?.name} required>
          {(control) => <Input {...control} name="name" autoComplete="name" required />}
        </Field>

        <Field
          label="Your flat"
          htmlFor="jr-unit"
          error={request.fieldErrors?.unit_id}
          hint={
            lookup.units?.length
              ? 'Pick the flat you live in — the admin checks this.'
              : 'This society hasn’t added its flats yet. You can still ask to join.'
          }
        >
          {(control) => (
            <Select {...control} name="unit_id" defaultValue="">
              <option value="">Not listed / not sure</option>
              {(lookup.units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unitLabel(unit)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="You are the" htmlFor="jr-relation">
            {(control) => (
              <Select {...control} name="relation" defaultValue="owner">
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
                <option value="family">Family member</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>
          <Field label="Phone" htmlFor="jr-phone" error={request.fieldErrors?.phone}>
            {(control) => <Input {...control} name="phone" type="tel" placeholder="9876543210" />}
          </Field>
        </div>

        {request.error ? (
          <p role="alert" className="text-danger text-sm">
            {request.error}
          </p>
        ) : null}

        <Submit label="Ask to join" busy="Sending…" />
      </form>
    );
  }

  return (
    <form action={lookupAction} className="space-y-4">
      <Field
        label="Society ID"
        htmlFor="join-code"
        error={lookup.fieldErrors?.join_code ?? lookup.error}
        hint="Your society admin shares this — it looks like MHR4827."
        required
      >
        {(control) => (
          <Input
            {...control}
            name="join_code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="MHR4827"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className="text-center font-mono text-lg tracking-[0.2em]"
          />
        )}
      </Field>
      <Submit label="Continue" busy="Checking…" />
    </form>
  );
}

/** The invite-code path: already approved, so it lets the resident straight in. */
function InviteCodeFlow() {
  const [check, checkAction] = useActionState(checkInviteCode, inviteInitial);
  const [redeem, redeemAction] = useActionState(redeemInviteCode, inviteInitial);
  const [code, setCode] = useState('');

  if (check.preview) {
    return (
      <form action={redeemAction} className="space-y-4">
        <input type="hidden" name="code" value={check.preview.code} />
        <div className="border-border-base bg-surface-sunken rounded-xl border p-4">
          <p className="text-ink-subtle text-xs tracking-wide uppercase">You’re joining</p>
          <p className="text-ink mt-1 text-lg font-semibold tracking-tight">
            {check.preview.communityName}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Your role</dt>
              <dd className="text-ink font-medium">{ROLE_LABEL[check.preview.role]}</dd>
            </div>
            {check.preview.unitLabel ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Flat</dt>
                <dd className="text-ink font-medium">{check.preview.unitLabel}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {redeem.error ? (
          <p role="alert" className="text-danger text-sm">
            {redeem.error}
          </p>
        ) : null}

        <Submit label={`Join ${check.preview.communityName}`} busy="Joining…" />
      </form>
    );
  }

  return (
    <form action={checkAction} className="space-y-4">
      <Field
        label="Invite code"
        htmlFor="invite-code"
        error={check.error}
        hint="A code like ABCD-1234 lets you in straight away."
        required
      >
        {(control) => (
          <Input
            {...control}
            name="code"
            value={code}
            onChange={(event) => setCode(formatInviteCode(event.target.value))}
            placeholder="ABCD-1234"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            required
            className="text-center font-mono text-lg tracking-[0.2em]"
          />
        )}
      </Field>
      <Submit label="Continue" busy="Checking…" />
    </form>
  );
}

export function JoinFlow() {
  const [mode, setMode] = useState<'society' | 'invite'>('society');

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="How to join"
        className="border-border-base bg-surface-raised flex gap-1 rounded-lg border p-1 text-sm"
      >
        {(
          [
            ['society', 'Society ID'],
            ['invite', 'Invite code'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={
              mode === value
                ? 'bg-surface-sunken text-ink flex-1 rounded-md px-3 py-1.5 font-medium'
                : 'text-ink-muted hover:text-ink flex-1 rounded-md px-3 py-1.5'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody>
          {mode === 'society' ? <SocietyIdFlow /> : <InviteCodeFlow />}
          <p className="text-ink-subtle mt-4 flex items-start gap-2 text-xs">
            <Ticket className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {mode === 'society'
              ? 'A Society ID only lets you ask. Your admin approves who actually gets in.'
              : 'An invite code is already approved, so it lets you in immediately.'}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
