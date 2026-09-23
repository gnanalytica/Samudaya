/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/capture.mjs and deleted again when the capture finishes, so
// nothing here is ever built, linted or shipped.
//
// The app's own shell, with the data the real layout would have fetched handed
// to it directly. Every component below is the one production renders —
// CommunitySwitcher, SidebarNav, ProfileMenu, NotificationBell, BottomNav — so
// the chrome in the video is the chrome in the app, not a drawing of it.
//
// The pages underneath are served at /zz-demo/* and reached at
// /app/shanti-nivas/*, which capture.mjs rewrites in the proxy. That matters:
// SidebarNav builds its hrefs from the slug and lights the active one from
// usePathname(), so a demo served at its own path would navigate nowhere and
// highlight nothing. Rewritten, the real navigation works for real.
import { CommunitySwitcher } from '@/components/community-switcher';
import { DismissMenus } from '@/components/dismiss-menus';
import { MobileNavSheet } from '@/components/mobile-nav-sheet';
import { BottomNav, SidebarNav } from '@/components/sidebar-nav';
import { NotificationBell } from '@/components/notification-bell';
import { ProfileMenu } from '@/components/profile-menu';
import { SOCIETY, YOU } from './demo-data';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const switcher = (
    <CommunitySwitcher
      current={{ name: SOCIETY.name, slug: SOCIETY.slug }}
      role={YOU.role}
      memberships={[]}
    />
  );
  const nav = <SidebarNav slug={SOCIETY.slug} role={YOU.role} counts={{ todo: 2 }} />;

  return (
    <div className="flex min-h-dvh">
      <DismissMenus />
      <aside className="border-border-base bg-surface-raised sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-4 md:flex">
        {switcher}
        <div className="mt-4 flex-1 overflow-y-auto">{nav}</div>
        <div className="border-border-base mt-4 border-t pt-3">
          <ProfileMenu slug={SOCIETY.slug} name={YOU.name} email={YOU.email} unread={3} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border-base bg-surface-raised/95 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur md:hidden">
          <MobileNavSheet societyName={SOCIETY.name}>
            {switcher}
            {nav}
          </MobileNavSheet>
          <div className="flex items-center gap-1">
            <NotificationBell slug={SOCIETY.slug} unread={3} className="p-1.5" />
            <ProfileMenu slug={SOCIETY.slug} name={YOU.name} unread={0} compact />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
          {children}
        </main>

        <BottomNav slug={SOCIETY.slug} role={YOU.role} counts={{ todo: 2 }} />
      </div>
    </div>
  );
}
