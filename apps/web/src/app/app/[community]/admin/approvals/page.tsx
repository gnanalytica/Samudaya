import { redirect } from 'next/navigation';

/** Committee approvals now live in the To do queue, alongside everything else waiting. */
export default async function ApprovalsPage(props: PageProps<'/app/[community]/admin/approvals'>) {
  const { community: slug } = await props.params;
  redirect(`/app/${slug}/todo`);
}
