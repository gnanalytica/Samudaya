import { can } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSocietySuggestions } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SuggestionBoard } from '@/components/suggestion-board';
import { SocietySuggestionForm } from './suggest-form';

export const metadata = { title: 'Ideas' };

/**
 * The society's own suggestions, as opposed to one event's.
 *
 * Fundraising was the only thing a resident could start from Home, which left
 * everything that costs nothing — a weekly badminton hour, a rule about the
 * terrace, a thank-you for the security staff — with nowhere to go. It runs
 * through the same three stages an event's suggestion does.
 */
export default async function SuggestPage(props: PageProps<'/app/[community]/suggest'>) {
  const { community: slug } = await props.params;
  const { community, viewRole: role, membership } = await requireCommunity(slug);
  const rows = await getSocietySuggestions(community.id, membership.id);

  const open = rows.filter((row) => row.status === 'accepted').length;
  const waiting = rows.filter((row) => row.status === 'new').length;

  return (
    <>
      <PageHeader
        title="Ideas for the society"
        description={
          open || waiting
            ? [
                open ? `${open} open for voting` : null,
                waiting ? `${waiting} with the committee` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Anything that is not about one event — an activity worth doing, or something for the committee.'
        }
      />
      <PageBody>
        {can(role, 'suggest') ? (
          <Card className="mb-3">
            <CardHeader
              title="Suggest something"
              description="The committee reads every suggestion, then puts it to residents for a vote."
            />
            <CardBody>
              <SocietySuggestionForm slug={community.slug} />
            </CardBody>
          </Card>
        ) : null}

        <SuggestionBoard
          slug={community.slug}
          rows={rows}
          myMembershipId={membership.id}
          canVote={can(role, 'vote')}
          canApprove={can(role, 'suggestions:approve')}
          emptyDescription="Suggest something above, and the committee will put it to a vote."
        />
      </PageBody>
    </>
  );
}
