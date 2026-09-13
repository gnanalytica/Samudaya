import { redirect } from 'next/navigation';

/** An event's accounts are its Money tab now; old links and WhatsApp messages land there. */
export default async function AccountsPage(
  props: PageProps<'/app/[community]/events/[event]/accounts'>,
) {
  const { community: slug, event } = await props.params;
  redirect(`/app/${slug}/events/${event}?tab=money`);
}
