'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ROLE_LABEL, formatInviteCode } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { checkInviteCode, redeemInviteCode, type JoinState } from './actions';

const initial: JoinState = {};

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function JoinForm() {
  const [checkState, checkAction] = useActionState(checkInviteCode, initial);
  const [redeemState, redeemAction] = useActionState(redeemInviteCode, initial);
  const [code, setCode] = useState('');

  const preview = checkState.preview;

  if (preview) {
    return (
      <form action={redeemAction} className="space-y-4">
        <input type="hidden" name="code" value={preview.code} />
        <div className="border-border-base bg-surface-sunken rounded-xl border p-4">
          <p className="text-ink-subtle text-xs tracking-wide uppercase">You’re joining</p>
          <p className="text-ink mt-1 text-lg font-semibold tracking-tight">
            {preview.communityName}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Your role</dt>
              <dd className="text-ink font-medium">{ROLE_LABEL[preview.role]}</dd>
            </div>
            {preview.unitLabel ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Unit</dt>
                <dd className="text-ink font-medium">{preview.unitLabel}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {redeemState.error ? (
          <p role="alert" className="text-danger text-sm">
            {redeemState.error}
          </p>
        ) : null}

        <Submit label={`Join ${preview.communityName}`} busy="Joining…" />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-ink-muted w-full text-sm underline underline-offset-4"
        >
          Use a different code
        </button>
      </form>
    );
  }

  return (
    <form action={checkAction} className="space-y-4">
      <Field
        label="Invite code"
        htmlFor="code"
        error={checkState.error}
        hint="Your community admin gives you this — it looks like ABCD-1234."
        required
      >
        {(control) => (
          <Input
            {...control}
            name="code"
            value={code}
            onChange={(event) => setCode(formatInviteCode(event.target.value))}
            placeholder="ABCD-1234"
            autoComplete="one-time-code"
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
