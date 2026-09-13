import Link from 'next/link';
import { getMemberships, requireCommunity } from '@/lib/auth';
import { CommunitySwitcher } from '@/components/community-switcher';
import { BottomNav, SidebarNav } from '@/components/sidebar-nav';
import { NotificationBell } from '@/components/notification-bell';
import { ProfileMenu } from '@/components/profile-menu';
import { getSupabase } from '@/lib/supabase/server';
import { getTodoItems } from '@/lib/todo';

export default async function CommunityLayout(props: LayoutProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  // Redirects to onboarding or another community if this one is not theirs.
  const { community, role, profile } = await requireCommunity(slug);
  const supabase = await getSupabase();

  // RLS limits this to the member's own notifications; the To do queue is
  // empty for residents without a round trip.
  const [memberships, { count: unread }, todo] = await Promise.all([
    getMemberships(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .is('read_at', null),
    getTodoItems(community.id, role),
  ]);
  const counts = { todo: todo.length };
  const name = profile?.full_name ?? 'You';

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border-base bg-surface-raised sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-4 md:flex">
        <CommunitySwitcher
          current={{ name: community.name, slug: community.slug }}
          role={role}
          memberships={memberships}
        />

        <div className="mt-4 flex-1 overflow-y-auto">
          <SidebarNav slug={community.slug} role={role} counts={counts} />
        </div>

        <div className="border-border-base mt-4 border-t pt-3">
          <ProfileMenu
            slug={community.slug}
            name={name}
            email={profile?.email}
            unread={unread ?? 0}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border-base bg-surface-raised/95 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur md:hidden">
          <Link href={`/app/${community.slug}`} className="flex min-w-0 items-center gap-2">
            <span className="bg-accent text-accent-ink grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold">
              {community.name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-sm font-semibold">{community.name}</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell slug={community.slug} unread={unread ?? 0} className="p-1.5" />
            <ProfileMenu slug={community.slug} name={name} unread={0} compact />
          </div>
        </header>

        {/* Bottom padding clears the mobile nav bar. */}
        <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
          {props.children}
        </main>

        <BottomNav slug={community.slug} role={role} counts={counts} />
      </div>
    </div>
  );
}
