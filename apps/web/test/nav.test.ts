import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bottomNavItems, visibleNav } from '@/components/nav-items';
import { eventTabsFor } from '@/components/event-tabs';

describe('bottomNavItems', () => {
  it('gives a resident Home, Events, People and Me', () => {
    const labels = bottomNavItems('arkala', 'resident').map((item) => item.label);
    expect(labels).toEqual(['Home', 'Events', 'People', 'Me']);
  });

  it('trades People for Manage once you run the society', () => {
    // The shape the phone app has always had. People does not disappear: Home
    // links to it, and it is the first row of the Manage hub.
    for (const role of ['staff', 'committee'] as const) {
      const labels = bottomNavItems('arkala', role).map((item) => item.label);
      expect(labels, role).toEqual(['Home', 'Events', 'Manage', 'Me']);
    }
  });

  it('never grows past four, which is what a 360px phone fits', () => {
    for (const role of ['resident', 'staff', 'committee'] as const) {
      expect(bottomNavItems('arkala', role), role).toHaveLength(4);
    }
  });

  const manageTab = () => bottomNavItems('arkala', 'committee').find((i) => i.label === 'Manage');

  it('puts the To do count on the tab, so the work is visible without opening it', () => {
    expect(manageTab()?.href).toBe('/app/arkala/manage');
    expect(manageTab()?.badge).toBe('todo');
  });

  it('keeps Manage lit inside the pages it leads to', () => {
    // Otherwise walking from Manage into Reconcile puts out every light on the
    // bar, and the app reads as nowhere.
    expect(manageTab()?.covers).toEqual([
      '/app/arkala/todo',
      '/app/arkala/admin',
      '/app/arkala/people',
    ]);
  });

  it('keeps the hub out of the sidebar, which lists those rows itself', () => {
    const hrefs = visibleNav('arkala', 'committee').flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain('/app/arkala/manage');
  });

  it('still gives staff their console, in the sidebar', () => {
    const sections = visibleNav('arkala', 'staff').map((group) => group.section);
    expect(sections).toContain('Manage');
    const resident = visibleNav('arkala', 'resident').map((group) => group.section);
    expect(resident).not.toContain('Manage');
  });
});

describe('who can reach the money', () => {
  const labels = (role: 'resident' | 'staff' | 'committee') =>
    visibleNav('arkala', role).flatMap((group) => group.items.map((item) => item.label));

  it('shows every member the society ledger', () => {
    // The point of the product. A resident who cannot see where the money went
    // has a noticeboard, not a transparent society.
    for (const role of ['resident', 'staff', 'committee'] as const) {
      expect(labels(role), role).toContain('Money');
    }
  });

  it('keeps the bank feed to the people who handle it', () => {
    // A statement line carries the name and bank of whoever sent the money.
    expect(labels('resident')).not.toContain('Reconcile');
    expect(labels('staff')).toContain('Reconcile');
    expect(labels('committee')).toContain('Reconcile');
  });
});

describe('eventTabsFor', () => {
  const published = { kind: 'event', status: 'published' } as const;

  it('shows a resident what they may read and nothing they may not use', () => {
    const tabs = eventTabsFor({ role: 'resident', ...published });
    expect(tabs.map((t) => t.id)).toEqual(['about', 'money', 'activities', 'vote']);
  });

  it('carries on into the console for whoever runs the event', () => {
    const ids = eventTabsFor({ role: 'committee', ...published }).map((t) => t.id);
    // One strip: the reader's tabs, then the organiser's, in that order.
    expect(ids.slice(0, 4)).toEqual(['about', 'money', 'activities', 'vote']);
    expect(ids).toContain('bills');
    expect(ids).toContain('payments');
  });

  it('gives staff everything except closing the books', () => {
    const ids = eventTabsFor({ role: 'staff', ...published }).map((t) => t.id);
    expect(ids).toContain('bills');
    expect(ids).not.toContain('close');
  });

  it('drops what a campaign does not have', () => {
    const ids = eventTabsFor({ role: 'committee', kind: 'campaign', status: 'published' }).map(
      (t) => t.id,
    );
    expect(ids).not.toContain('activities');
    expect(ids).not.toContain('budget');
    expect(ids).toContain('money');
  });

  it('has nothing to vote on before the committee approves the campaign', () => {
    const ids = eventTabsFor({ role: 'resident', kind: 'campaign', status: 'proposed' }).map(
      (t) => t.id,
    );
    expect(ids).not.toContain('vote');
  });
});

// ---------------------------------------------------------------------------
// The chrome around the pages
// ---------------------------------------------------------------------------
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/**
 * The bar carries four tabs and that is the right number to fit. Everything
 * else lived in the sidebar — and the sidebar is `hidden md:flex`, so on a
 * phone there was no route at all to Manage, To do, Reconcile, Society
 * settings, Money or Ideas, nor to the society switcher and the join-and-
 * create links inside it.
 *
 * Worth noticing that "still gives staff their console, in the sidebar" above
 * passed the entire time. It asserted the item exists, not that anybody could
 * reach it; on a phone, nobody could.
 *
 * The sheet fixed that, and the two things people reach for daily have since
 * come out of it and onto surfaces of their own: Manage has a tab, and the
 * join-and-found links sit on Me. The sheet still carries the rest.
 */
describe('a phone reaches everything a desktop does', () => {
  const layout = () => read('app', 'app', '[community]', 'layout.tsx');

  it('renders one nav element into both the sidebar and the sheet', () => {
    // Built once and used twice, rather than two lists that drift — and the
    // half that drifted was the half only phones could see.
    expect(count(layout(), 'const nav = <SidebarNav')).toBe(1);
    expect(count(layout(), '{nav}')).toBe(2);
  });

  it('does the same with the society switcher, so a phone can join a second one', () => {
    expect(count(layout(), 'const switcher = (')).toBe(1);
    expect(count(layout(), '{switcher}')).toBe(2);
  });

  it('opens the sheet from the society name rather than linking to Home again', () => {
    // The bottom bar already goes Home; spending the header on a second route
    // to it is what left the rest of the app with none.
    expect(layout()).toContain('<MobileNavSheet');
    expect(layout()).not.toContain('href={`/app/${community.slug}`}');
  });

  it('escapes the header stacking context, or the bottom bar paints over it', () => {
    // The header is `sticky z-30`, the bottom bar `fixed z-40` outside it. A
    // sheet at z-50 *inside* the header still loses: z-index is relative to
    // the context you are in.
    expect(read('components', 'mobile-nav-sheet.tsx')).toContain('createPortal');
  });

  it('has a page behind the Manage tab, gated by what its rows need', () => {
    // A tab that lands on a redirect is worse than no tab.
    const page = read('app', 'app', '[community]', 'manage', 'page.tsx');
    expect(page).toContain("requireCapability(slug, 'events:manage')");
    expect(page).toContain("can(role, 'payments:record')");
  });

  it('offers joining and founding a society from Me, not only from the switcher', () => {
    const me = read('app', 'app', '[community]', 'me', 'page.tsx');
    expect(me).toContain('/onboarding?mode=join');
    expect(me).toContain('/onboarding?mode=create');
  });

  it('lets go of the page when the window grows into sidebar territory', () => {
    // `md:hidden` alone hides the sheet without closing it, so the scroll lock
    // stays on with the trigger hidden too and nothing left to release it. A
    // tablet rotating into landscape is enough to reach that.
    const sheet = read('components', 'mobile-nav-sheet.tsx');
    expect(sheet).toContain("matchMedia('(min-width: 48rem)')");
    expect(count(sheet, "wide.addEventListener('change'")).toBe(1);
    expect(count(sheet, "wide.removeEventListener('change'")).toBe(1);
  });
});

/**
 * A `<details>` is a disclosure widget, not a menu: it does not close when you
 * click elsewhere. For the two that float over the page that read as the app
 * being stuck, especially on a phone where the menu covers what you were
 * trying to tap.
 */
describe('menus that float over the page dismiss', () => {
  const OVERLAY = /absolute[^"']*\bz-\d|z-\d[^"']*\babsolute/;

  it('marks every floating menu so the outside-click handler finds it', () => {
    const components = readdirSync(join(SRC, 'components'))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => [f, read('components', f)] as const);
    const unmarked = components
      .filter(([, body]) => OVERLAY.test(body) && body.includes('<details'))
      .filter(([, body]) => !body.includes('data-menu'))
      .map(([name]) => name);
    expect(unmarked).toEqual([]);
  });

  it('leaves the inline accordions alone, so a half-typed comment survives', () => {
    // These are disclosures, not menus. Closing them because somebody clicked
    // the page would throw away whatever they were partway through.
    for (const file of ['comment-thread.tsx', 'suggestion-board.tsx']) {
      const body = read('components', file);
      expect(body, file).toContain('<details');
      expect(body, file).not.toContain('data-menu');
    }
  });

  it('closes on Escape and on the click that navigates, not only on outside taps', () => {
    const handler = read('components', 'dismiss-menus.tsx');
    expect(handler).toContain('Escape');
    expect(handler).toContain('pointerdown');
    // A link to the page you are already on changes no pathname.
    expect(handler).toContain('button[type="submit"]');
  });

  it('peels one layer per Escape, rather than menu and sheet together', () => {
    // The switcher lives inside the sheet on a phone. Both listen on the
    // document, so without this an Escape aimed at the open menu takes the
    // sheet with it and you are back where you started.
    expect(read('components', 'dismiss-menus.tsx')).toContain('preventDefault');
    expect(read('components', 'mobile-nav-sheet.tsx')).toContain('!event.defaultPrevented');
  });
});
