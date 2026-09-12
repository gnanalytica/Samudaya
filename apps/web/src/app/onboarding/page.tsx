import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMemberships, requireUser } from '@/lib/auth';
import { Card, CardBody } from '@/components/ui/card';
import { JoinForm } from './join-form';
import { CreateCommunityForm } from './create-form';

export const metadata = { title: 'Join your community' };

export default async function OnboardingPage(props: { searchParams: Promise<{ mode?: string }> }) {
  await requireUser();
  const { mode } = await props.searchParams;

  // Someone who already belongs somewhere lands here only by typing the URL.
  // Send them to their community unless they explicitly came to add another.
  const memberships = await getMemberships();
  const firstSlug = memberships[0]?.communities?.slug;
  if (firstSlug && mode !== 'join' && mode !== 'create') {
    redirect(`/app/${firstSlug}`);
  }

  const creating = mode === 'create';

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start">
        <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg text-sm font-bold">
          स
        </span>
        <span className="text-lg font-semibold tracking-tight">Samudaya</span>
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">
        {creating ? 'Set up your community' : 'Join your community'}
      </h1>
      <p className="text-ink-muted mt-1.5 mb-8 text-sm">
        {creating
          ? 'Create the space your residents will join.'
          : 'Enter the invite code from your society admin.'}
      </p>

      <Card>
        <CardBody>{creating ? <CreateCommunityForm /> : <JoinForm />}</CardBody>
      </Card>

      <p className="text-ink-muted mt-6 text-center text-sm">
        {creating ? (
          <>
            Have an invite code instead?{' '}
            <Link href="/onboarding?mode=join" className="text-accent underline underline-offset-4">
              Join a community
            </Link>
          </>
        ) : (
          <>
            Setting up a new society?{' '}
            <Link
              href="/onboarding?mode=create"
              className="text-accent underline underline-offset-4"
            >
              Create a community
            </Link>
          </>
        )}
      </p>

      <form action="/auth/signout" method="post" className="mt-8 text-center">
        <button type="submit" className="text-ink-subtle text-xs underline underline-offset-4">
          Sign out
        </button>
      </form>
    </main>
  );
}
