/**
 * The discussion under an event or a suggestion, read as a conversation: who
 * said what, in turns, and the faces people put on it.
 *
 * Half of what gets said in a society's group chat is a thumbs-up. Typed as a
 * comment it notified everybody in the thread and buried the comments that
 * said something, so a reaction is its own thing: one of a few faces, once
 * each, by anybody in the society, on any comment, their own included.
 */

/**
 * The faces a comment can get, in the order they are offered. The database
 * holds the same list (comment_reactions_known_face), so a reaction is never a
 * way to post text that skips the comment rules.
 */
export const COMMENT_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '😮'] as const;

export type CommentReaction = (typeof COMMENT_REACTIONS)[number];

/** What a screen reader says for each face. */
export const REACTION_LABEL: Record<CommentReaction, string> = {
  '👍': 'Thumbs up',
  '❤️': 'Love',
  '😂': 'Laughing',
  '🎉': 'Celebrate',
  '🙏': 'Thank you',
  '😮': 'Surprised',
};

export function isCommentReaction(value: unknown): value is CommentReaction {
  return (COMMENT_REACTIONS as readonly unknown[]).includes(value);
}

/** One face on one comment: how many, whether the reader is one of them, and who. */
export type ReactionSummary = {
  symbol: CommentReaction;
  count: number;
  mine: boolean;
  /** Everyone who reacted with it, the reader included, oldest first. */
  names: string[];
};

/**
 * The reactions on each comment, face by face in the order they are offered,
 * with the reader's own marked so the chip can show it is pressed.
 */
export function summarizeReactions(
  rows: {
    comment_id: string;
    emoji: string;
    membership_id: string;
    name?: string | null;
  }[],
  myMembershipId: string | null,
): Map<string, ReactionSummary[]> {
  const byComment = new Map<string, Map<CommentReaction, ReactionSummary>>();
  for (const row of rows) {
    if (!isCommentReaction(row.emoji)) continue;
    const faces = byComment.get(row.comment_id) ?? new Map<CommentReaction, ReactionSummary>();
    const face = faces.get(row.emoji) ?? { symbol: row.emoji, count: 0, mine: false, names: [] };
    face.count += 1;
    if (row.membership_id === myMembershipId) {
      face.mine = true;
      face.names.push('You');
    } else {
      face.names.push(row.name?.trim() || 'A resident');
    }
    faces.set(row.emoji, face);
    byComment.set(row.comment_id, faces);
  }
  const ordered = new Map<string, ReactionSummary[]>();
  for (const [commentId, faces] of byComment) {
    ordered.set(
      commentId,
      COMMENT_REACTIONS.flatMap((symbol) => {
        const face = faces.get(symbol);
        return face ? [face] : [];
      }),
    );
  }
  return ordered;
}

/**
 * Who reacted, as a sentence for the chip's tooltip: "You", "You and Asha",
 * "Asha, Bala and 3 others". The reader comes first when they are one of them.
 */
export function reactedBy(names: string[]): string {
  const sorted = [...names].sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0));
  if (sorted.length <= 2) return sorted.join(' and ');
  const shown = sorted.slice(0, 2);
  const rest = sorted.length - shown.length;
  return `${shown.join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/**
 * Whether a comment starts a new turn in the conversation and so gets a name
 * over it: a different person from the one before, or the same person after a
 * long enough pause that it reads as a new thought. Consecutive messages from
 * one person sit under one name, the way every chat app draws them.
 */
export function startsTurn(
  previous: { membership_id: string; created_at: string } | null | undefined,
  current: { membership_id: string; created_at: string },
  pauseMinutes = 10,
): boolean {
  if (!previous || previous.membership_id !== current.membership_id) return true;
  const gap = Date.parse(current.created_at) - Date.parse(previous.created_at);
  return !(gap >= 0 && gap < pauseMinutes * 60_000);
}

/**
 * The reactions on a comment with the reader's own face added or taken off:
 * what the chip row shows the moment it is tapped, before the server answers.
 */
export function withReactionToggled(
  reactions: ReactionSummary[],
  symbol: CommentReaction,
): ReactionSummary[] {
  const existing = reactions.find((face) => face.symbol === symbol);
  if (existing?.mine) {
    return reactions.flatMap((face) => {
      if (face.symbol !== symbol) return [face];
      if (face.count <= 1) return [];
      const names = [...face.names];
      names.splice(names.indexOf('You'), 1);
      return [{ ...face, count: face.count - 1, mine: false, names }];
    });
  }
  const added = existing
    ? { ...existing, count: existing.count + 1, mine: true, names: [...existing.names, 'You'] }
    : { symbol, count: 1, mine: true, names: ['You'] };
  return COMMENT_REACTIONS.flatMap((face) => {
    if (face === symbol) return [added];
    const kept = reactions.find((reaction) => reaction.symbol === face);
    return kept ? [kept] : [];
  });
}
