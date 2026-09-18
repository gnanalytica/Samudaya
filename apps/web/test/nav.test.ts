import { describe, expect, it } from 'vitest';
import { bottomNavItems, visibleNav } from '@/components/nav-items';
import { eventTabsFor } from '@/components/event-tabs';

describe('bottomNavItems', () => {
  it('is the same four tabs whatever the role', () => {
    // It used to be six for staff, which did not fit — so People was dropped
    // from their bar, which is the nav admitting it was full.
    for (const role of ['resident', 'staff', 'committee'] as const) {
      const labels = bottomNavItems('arkala', role).map((item) => item.label);
      expect(labels, role).toEqual(['Home', 'Events', 'People', 'Me']);
    }
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
