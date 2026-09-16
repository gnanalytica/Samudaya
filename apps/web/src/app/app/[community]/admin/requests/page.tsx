import { redirect } from 'next/navigation';

/** Join requests now sit behind the People tabs, beside the members they become. */
export default async function RequestsRedirect(
  props: PageProps<'/app/[community]/admin/requests'>,
) {
  const { community } = await props.params;
  redirect(`/app/${community}/people/requests`);
}
