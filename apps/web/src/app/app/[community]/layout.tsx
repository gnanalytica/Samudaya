import Link from 'next/link';
import { getMemberships, requireCommunity } from '@/lib/auth';
import { CommunitySwitcher } from '@/components/community-switcher';
import { BottomNav, SidebarNav } from '@/components/sidebar-nav';
import { NotificationBell } from '@/components/notification-bell';
import { ProfileMenu } from '@/components/profile-menu';
import { ResidentViewBanner, ViewSwitch } from '@/components/view-switch';
import { getSupabase } from '@/lib/supabase/server';
import { getTodoCount } from '@/lib/todo';

export default async function CommunityLayout(props: LayoutProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  // Membership list for the switcher starts alongside the community check;
  // both are cached per request, so the redirect path reuses it too.
  const membershipsPromise = getMemberships();
  // Redirects to onboarding or another community if this one is not theirs.
  const { community, role, viewRole, viewMode, profile } = await requireCommunity(slug);
  const supabase = await getSupabase();

  // RLS limits this to the member's own notifications. The badge only needs a
  // number, so it asks todo_count() rather than building the whole queue.
  const [memberships, { count: unread }, todoCount] = await Promise.all([
    membershipsPromise,
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .is('read_at', null),
    getTodoCount(community.id, viewRole),
  ]);
  const counts = { todo: todoCount };
  const name = profile?.full_name ?? 'You';

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border-base bg-surface-raised sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-4 md:flex">
        <CommunitySwitcher
          current={{ name: community.name, slug: community.slug }}
          role={role}
          memberships={memberships}
        />
        {viewMode ? (
          <div className="mt-3 px-1">
            <ViewSwitch slug={community.slug} mode={viewMode} />
          </div>
        ) : null}

        <div className="mt-4 flex-1 overflow-y-auto">
          <SidebarNav slug={community.slug} role={viewRole} counts={counts} />
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
            <ProfileMenu slug={community.slug} name={name} unread={0} viewMode={viewMode} compact />
          </div>
        </header>

        {/* Bottom padding clears the mobile nav bar. */}
        <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
          {viewMode === 'resident' ? <ResidentViewBanner slug={community.slug} /> : null}
          {props.children}
        </main>

        <BottomNav slug={community.slug} role={viewRole} counts={counts} />
      </div>
    </div>
  );
}
