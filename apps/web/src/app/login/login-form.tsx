'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { signInWithEmail, signInWithGoogle, type LoginState } from './actions';

const initial: LoginState = {};

function SubmitButton({
  children,
  variant = 'primary',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className="w-full" disabled={pending}>
      {pending ? 'One moment…' : children}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4h6.6c-.1 1.1-.9 2.8-2.5 3.9l3.8 3c2.3-2.1 3.6-5.2 3.6-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-3c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5L1.2 17.4C3.2 21.3 7.3 24 12 24z"
      />
      <path fill="#FBBC05" d="M5.1 14.3a7.4 7.4 0 0 1 0-4.6L1.2 6.6a12 12 0 0 0 0 10.8z" />
      <path
        fill="#EA4335"
        d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l3.9 3.1C6.1 6.9 8.8 4.8 12 4.8z"
      />
    </svg>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [googleState, googleAction] = useActionState(signInWithGoogle, initial);
  const [emailState, emailAction] = useActionState(signInWithEmail, initial);

  if (emailState.sent) {
    return (
      <div className="border-border-base bg-surface-raised rounded-xl border p-5 text-center">
        <p className="text-ink text-sm font-medium">Check your email</p>
        <p className="text-ink-muted mt-1 text-sm">
          We sent a sign-in link to <span className="text-ink font-medium">{emailState.sent}</span>.
          It’s good for one hour.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form action={googleAction}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="secondary">
          <GoogleMark />
          Continue with Google
        </SubmitButton>
        {googleState.error ? (
          <p role="alert" className="text-danger mt-2 text-xs">
            {googleState.error}
          </p>
        ) : null}
      </form>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="bg-border-base h-px flex-1" />
        <span className="text-ink-subtle text-xs">or</span>
        <span className="bg-border-base h-px flex-1" />
      </div>

      <form action={emailAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <Field
          label="Email"
          htmlFor="email"
          error={emailState.error}
          hint="We’ll email you a link — no password to remember."
        >
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          )}
        </Field>
        <SubmitButton>Email me a link</SubmitButton>
      </form>
    </div>
  );
}
