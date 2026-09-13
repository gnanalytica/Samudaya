import { describe, expect, it } from 'vitest';
import { EVENT_TABS, TODO_KIND, TODO_ORDER, eventSlug } from '../src/copy';

describe('shared copy', () => {
  it('covers every to-do kind in the display order', () => {
    expect(new Set(TODO_ORDER)).toEqual(new Set(Object.keys(TODO_KIND)));
  });

  it('has four event tabs', () => {
    expect(EVENT_TABS.map((tab) => tab.id)).toEqual(['about', 'money', 'activities', 'vote']);
  });

  it('generates a valid event web address from the name', () => {
    expect(eventSlug('Deepavali Habba 2026!')).toBe('deepavali-habba-2026');
    expect(eventSlug('ಗಣೇಶ')).toBe('event');
    expect(eventSlug('Ganesh Chaturthi', '2')).toBe('ganesh-chaturthi-2');
    expect(eventSlug('Ganesh Chaturthi')).toMatch(/^[a-z0-9][a-z0-9-]{1,60}$/);
  });
});
