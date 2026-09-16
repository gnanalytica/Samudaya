import { redirect } from 'next/navigation';

/** Moved out of the admin console: every member can see the society's people now. */
export default async function MembersRedirect(props: PageProps<'/app/[community]/admin/members'>) {
  const { community } = await props.params;
  redirect(`/app/${community}/people`);
}
