import { Bell, Pin, Trash2 } from 'lucide-react';
import { AUDIENCE_LABEL, can, relativeTime } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { NoticeComposer } from './notice-composer';
import { deleteAnnouncement } from './actions';

export const metadata = { title: 'Notices' };

export default async function NoticesPage(props: PageProps<'/app/[community]/notices'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const canPost = can(role, 'announcements:post');
  const now = new Date().toISOString();

  // Staff see everything so they can manage it; residents only get what RLS
  // lets through, which already excludes expired and out-of-audience notices.
  let query = supabase
    .from('announcements')
    .select('id, title, body, audience, is_pinned, published_at, expires_at')
    .eq('community_id', community.id)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50);

  if (!canPost) {
    query = query.lte('published_at', now).or(`expires_at.is.null,expires_at.gt.${now}`);
  }

  const { data: notices } = await query;

  return (
    <>
      <PageHeader
        title="Notices"
        description={
          canPost
            ? 'Post announcements and manage what residents see.'
            : 'Announcements from your community.'
        }
      />

      <PageBody>
        <div className={canPost ? 'grid gap-5 lg:grid-cols-[1fr_380px]' : ''}>
          <div className="space-y-3">
            {notices?.length ? (
              notices.map((notice) => {
                const expired = notice.expires_at && new Date(notice.expires_at) <= new Date();
                return (
                  <Card key={notice.id} className={expired ? 'opacity-60' : undefined}>
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-ink flex items-center gap-1.5 text-sm font-semibold">
                            {notice.is_pinned ? (
                              <Pin className="text-accent size-3.5" aria-label="Pinned" />
                            ) : null}
                            {notice.title}
                          </h2>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {relativeTime(notice.published_at)}
                            {notice.audience !== 'all'
                              ? ` · ${AUDIENCE_LABEL[notice.audience]}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {expired ? <Badge tone="neutral">Expired</Badge> : null}
                          {canPost ? (
                            <form action={deleteAnnouncement}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="id" value={notice.id} />
                              <button
                                type="submit"
                                aria-label={`Delete notice: ${notice.title}`}
                                className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-1.5"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-ink-muted mt-2 text-sm whitespace-pre-wrap">
                        {notice.body}
                      </p>
                    </div>
                  </Card>
                );
              })
            ) : (
              <Card>
                <EmptyState
                  icon={<Bell className="size-6" />}
                  title="No notices yet"
                  description={
                    canPost
                      ? 'Post the first one — residents will see it straight away.'
                      : 'When the committee posts something, it will appear here.'
                  }
                />
              </Card>
            )}
          </div>

          {canPost ? <NoticeComposer slug={slug} /> : null}
        </div>
      </PageBody>
    </>
  );
}
