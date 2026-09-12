import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Sign-in problem' };

export default async function AuthErrorPage(props: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await props.searchParams;

  const message =
    reason === 'missing_code'
      ? 'That sign-in link was incomplete. It may have been cut off by your email client.'
      : reason
        ? decodeURIComponent(reason)
        : 'Something went wrong while signing you in.';

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">We couldn’t sign you in</h1>
      <p className="text-ink-muted mt-2 text-sm">{message}</p>
      <p className="text-ink-muted mt-1 text-sm">
        Sign-in links can only be used once, and expire after an hour.
      </p>
      <div className="mt-6 flex gap-3">
        <ButtonLink href="/login">Try again</ButtonLink>
        <Link href="/" className="text-ink-muted self-center text-sm underline underline-offset-4">
          Back home
        </Link>
      </div>
    </main>
  );
}
