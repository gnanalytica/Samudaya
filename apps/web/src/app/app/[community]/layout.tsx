import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { getMemberships, requireCommunity } from '@/lib/auth';
import { CommunitySwitcher } from '@/components/community-switcher';
import { BottomNav, SidebarNav } from '@/components/sidebar-nav';
import { NotificationBell } from '@/components/notification-bell';
import { getSupabase } from '@/lib/supabase/server';

export default async function CommunityLayout(props: LayoutProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  // Redirects to onboarding or another community if this one is not theirs.
  const { community, role, profile } = await requireCommunity(slug);
  const memberships = await getMemberships();

  // RLS limits this to the member's own notifications.
  const supabase = await getSupabase();
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', community.id)
    .is('read_at', null);

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border-base bg-surface-raised sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-4 md:flex">
        <CommunitySwitcher
          current={{ name: community.name, slug: community.slug }}
          role={role}
          memberships={memberships}
        />

        <NotificationBell
          slug={community.slug}
          unread={unread ?? 0}
          showLabel
          className="mt-4 px-3 py-2"
        />

        <div className="mt-2 flex-1 overflow-y-auto">
          <SidebarNav slug={community.slug} role={role} />
        </div>

        <div className="border-border-base mt-4 border-t pt-3">
          <div className="px-3 pb-2">
            <p className="text-ink truncate text-sm font-medium">{profile?.full_name ?? 'You'}</p>
            <p className="text-ink-subtle truncate text-xs">{profile?.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-ink-muted hover:bg-surface-sunken hover:text-ink flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
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
            <form action="/auth/signout" method="post">
              <button type="submit" aria-label="Sign out" className="text-ink-muted p-1.5">
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>

        {/* Bottom padding clears the mobile nav bar. */}
        <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
          {props.children}
        </main>

        <BottomNav slug={community.slug} role={role} />
      </div>
    </div>
  );
}
