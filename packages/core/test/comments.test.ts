import { describe, expect, it } from 'vitest';
import {
  COMMENT_REACTIONS,
  REACTION_LABEL,
  isCommentReaction,
  reactedBy,
  startsTurn,
  summarizeReactions,
  withReactionToggled,
} from '../src/comments';

describe('the faces a comment can get', () => {
  it('are a short fixed set, each with words for a screen reader', () => {
    expect(COMMENT_REACTIONS.length).toBeLessThanOrEqual(8);
    for (const face of COMMENT_REACTIONS) expect(REACTION_LABEL[face]).toBeTruthy();
  });

  it('match the set the database accepts', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        'supabase',
        'migrations',
        '20261003000200_a_reply_can_be_a_face.sql',
      ),
      'utf8',
    );
    const inDatabase = sql.match(/emoji in \(([^)]*)\)/)?.[1]?.match(/'([^']+)'/g) ?? [];
    expect(inDatabase.map((face) => face.slice(1, -1))).toEqual([...COMMENT_REACTIONS]);
  });

  it('refuses anything else, text included', () => {
    expect(isCommentReaction('👍')).toBe(true);
    expect(isCommentReaction('lol')).toBe(false);
    expect(isCommentReaction('🍕')).toBe(false);
    expect(isCommentReaction(undefined)).toBe(false);
  });
});

describe('the reactions on each comment', () => {
  const rows = [
    { comment_id: 'a', emoji: '🎉', membership_id: 'ria', name: 'Ria Menon' },
    { comment_id: 'a', emoji: '👍', membership_id: 'tom', name: 'Tom Menon' },
    { comment_id: 'a', emoji: '👍', membership_id: 'me', name: 'Asha' },
    { comment_id: 'b', emoji: '❤️', membership_id: 'tom', name: 'Tom Menon' },
    { comment_id: 'b', emoji: 'lol', membership_id: 'tom', name: 'Tom Menon' },
  ];

  it('counts each face, in the order they are offered, and marks the reader’s own', () => {
    const summary = summarizeReactions(rows, 'me');
    expect(summary.get('a')).toEqual([
      { symbol: '👍', count: 2, mine: true, names: ['Tom Menon', 'You'] },
      { symbol: '🎉', count: 1, mine: false, names: ['Ria Menon'] },
    ]);
    expect(summary.get('b')).toEqual([
      { symbol: '❤️', count: 1, mine: false, names: ['Tom Menon'] },
    ]);
  });

  it('leaves a comment nobody reacted to out', () => {
    expect(summarizeReactions(rows, 'me').get('c')).toBeUndefined();
  });

  it('says who, reader first, and how many more', () => {
    expect(reactedBy(['You'])).toBe('You');
    expect(reactedBy(['Tom Menon', 'You'])).toBe('You and Tom Menon');
    expect(reactedBy(['Ria', 'Tom', 'You', 'Bala'])).toBe('You, Ria and 2 others');
    expect(reactedBy(['Ria', 'Tom', 'Bala'])).toBe('Ria, Tom and 1 other');
  });
});

describe('turns in the conversation', () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 3, 10, minutes)).toISOString();

  it('names the first message, and anyone who speaks after somebody else', () => {
    expect(startsTurn(null, { membership_id: 'ria', created_at: at(0) })).toBe(true);
    expect(
      startsTurn(
        { membership_id: 'ria', created_at: at(0) },
        { membership_id: 'tom', created_at: at(1) },
      ),
    ).toBe(true);
  });

  it('keeps one person’s run of messages under one name, until a long pause', () => {
    expect(
      startsTurn(
        { membership_id: 'ria', created_at: at(0) },
        { membership_id: 'ria', created_at: at(3) },
      ),
    ).toBe(false);
    expect(
      startsTurn(
        { membership_id: 'ria', created_at: at(0) },
        { membership_id: 'ria', created_at: at(25) },
      ),
    ).toBe(true);
  });
});

describe('tapping a face', () => {
  it('adds the reader’s own, in its place in the row', () => {
    const after = withReactionToggled(
      [{ symbol: '🎉', count: 1, mine: false, names: ['Ria'] }],
      '👍',
    );
    expect(after.map((face) => face.symbol)).toEqual(['👍', '🎉']);
    expect(after[0]).toEqual({ symbol: '👍', count: 1, mine: true, names: ['You'] });
  });

  it('joins a face others already put there', () => {
    const [face] = withReactionToggled(
      [{ symbol: '👍', count: 2, mine: false, names: ['Ria', 'Tom'] }],
      '👍',
    );
    expect(face).toEqual({ symbol: '👍', count: 3, mine: true, names: ['Ria', 'Tom', 'You'] });
  });

  it('takes the reader’s own off again, and the face with it when nobody else is left', () => {
    expect(
      withReactionToggled([{ symbol: '👍', count: 2, mine: true, names: ['Ria', 'You'] }], '👍'),
    ).toEqual([{ symbol: '👍', count: 1, mine: false, names: ['Ria'] }]);
    expect(
      withReactionToggled([{ symbol: '👍', count: 1, mine: true, names: ['You'] }], '👍'),
    ).toEqual([]);
  });
});
