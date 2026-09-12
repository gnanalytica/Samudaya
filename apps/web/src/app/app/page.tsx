import { redirect } from 'next/navigation';
import { getMemberships, requireUser } from '@/lib/auth';

/**
 * `/app` has no content of its own — it just sends the user to a community.
 * Which one depends on what they belong to.
 */
export default async function AppIndexPage() {
  await requireUser();
  const memberships = await getMemberships();
  const slug = memberships[0]?.communities?.slug;
  redirect(slug ? `/app/${slug}` : '/onboarding');
}
