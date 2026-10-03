import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What residents asked for after using an event page: a discussion that reads
 * like a chat, faces anyone can put on any message, evidence that opens over
 * the page instead of in a new tab, and somewhere to suggest an idea on every
 * event, closed ones included.
 */
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const MOBILE = join(import.meta.dirname, '..', '..', 'mobile');
const phone = (...parts: string[]) => readFileSync(join(MOBILE, ...parts), 'utf8');

describe('the discussion', () => {
  const thread = read('components', 'comment-thread.tsx');
  const forms = read('components', 'comment-forms.tsx');

  it('puts your messages on one side and everybody else’s on the other', () => {
    expect(thread).toContain("mine ? 'items-end' : 'items-start'");
    expect(thread).toContain('bg-accent text-accent-ink');
    expect(thread).toContain('bg-ink/[0.06] text-ink');
    // One name over each turn, not over every message in a run.
    expect(thread).toContain('startsTurn(');
  });

  it('lets anybody react to any message, their own included', () => {
    expect(thread).toContain('<CommentReactions');
    // Not inside a `mine` check: every message gets the reactions row.
    expect(thread).not.toMatch(/mine\s*\?\s*<CommentReactions/);
    expect(forms).toContain('toggleReaction(');
    expect(forms).toContain('COMMENT_REACTIONS.map(');
    expect(forms).toContain('useOptimistic(reactions, withReactionToggled)');
  });

  it('keeps the faces in core, matching the database, not typed into a screen', () => {
    expect(read(...['app', 'app', '[community]', 'events', 'actions.ts'])).toContain(
      'isCommentReaction(input.emoji)',
    );
  });
});

describe('a bill or a screenshot', () => {
  it('opens in a window over the page, with a new tab one tap away', () => {
    const link = read('components', 'bill-link.tsx');
    const preview = read('components', 'file-preview.tsx');
    expect(link).toContain('<FilePreviewButton');
    expect(link).not.toContain('target="_blank"');
    expect(preview).toContain('<dialog');
    expect(preview).toContain('showModal()');
    expect(preview).toContain('Open in a new tab');
  });

  it('opens a photo in place on the phone too', () => {
    const files = phone('src', 'components', 'file-ui.tsx');
    expect(files).toContain('<Modal');
    expect(files).toContain('isStoredImage(value)');
  });
});

describe('suggesting an idea from an event', () => {
  it('is offered at the top of the Ideas section', () => {
    const event = read('app', 'app', '[community]', 'events', '[event]', 'page.tsx');
    expect(event).toContain('href="#suggest-idea"');
    expect(event).toContain('id="suggest-idea"');
  });

  it('still works once the event is over, for the society’s next time', () => {
    const event = read('app', 'app', '[community]', 'events', '[event]', 'page.tsx');
    expect(event).toContain('<SocietySuggestionForm slug={slug} />');
    expect(event).not.toContain("can(role, 'suggest') && event.status === 'published'");
    expect(phone('app', 'event', '[slug].tsx')).toContain("[{ id: null, label: 'The society' }]");
  });
});
