/**
 * Parses what a resident types into WhatsApp into a command the bot can act
 * on. Kept free of any I/O so it can be unit tested exhaustively — the webhook
 * only dispatches on the result.
 *
 * People do not type carefully on a phone, so matching is case-insensitive,
 * tolerant of extra whitespace, and accepts the obvious synonyms.
 */

export type WhatsAppCommand =
  | { kind: 'help' }
  | { kind: 'link'; code: string }
  | { kind: 'notices' }
  | { kind: 'report'; text: string }
  | { kind: 'status' }
  | { kind: 'visitor'; name: string }
  | { kind: 'dues' }
  | { kind: 'amenities' }
  | { kind: 'stop' }
  | { kind: 'empty' }
  | { kind: 'unknown'; input: string };

const ALIASES: Record<string, WhatsAppCommand['kind']> = {
  help: 'help',
  menu: 'help',
  hi: 'help',
  hello: 'help',
  hey: 'help',
  start: 'help',
  '?': 'help',

  link: 'link',
  join: 'link',
  connect: 'link',

  notices: 'notices',
  notice: 'notices',
  announcements: 'notices',
  announcement: 'notices',
  news: 'notices',
  updates: 'notices',

  report: 'report',
  complaint: 'report',
  complain: 'report',
  issue: 'report',
  problem: 'report',
  raise: 'report',

  status: 'status',
  tickets: 'status',
  requests: 'status',
  my: 'status',

  visitor: 'visitor',
  guest: 'visitor',
  visit: 'visitor',

  dues: 'dues',
  balance: 'dues',
  bill: 'dues',
  bills: 'dues',
  payment: 'dues',
  payments: 'dues',

  amenities: 'amenities',
  amenity: 'amenities',
  facilities: 'amenities',
  book: 'amenities',

  stop: 'stop',
  unsubscribe: 'stop',
  optout: 'stop',
};

export function parseCommand(raw: string | null | undefined): WhatsAppCommand {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'empty' };

  const [head, ...rest] = text.split(/\s+/);
  const keyword = (head ?? '').toLowerCase().replace(/[^\w?]/g, '');
  const remainder = rest.join(' ').trim();
  const kind = ALIASES[keyword];

  switch (kind) {
    case 'help':
    case 'notices':
    case 'status':
    case 'dues':
    case 'amenities':
    case 'stop':
      return { kind };

    case 'link': {
      if (!remainder) return { kind: 'unknown', input: text };
      return { kind: 'link', code: remainder };
    }

    case 'report': {
      // "report" on its own is not actionable — we need to know what broke.
      if (!remainder) return { kind: 'unknown', input: text };
      return { kind: 'report', text: remainder };
    }

    case 'visitor': {
      if (!remainder) return { kind: 'unknown', input: text };
      return { kind: 'visitor', name: remainder };
    }

    default:
      return { kind: 'unknown', input: text };
  }
}

export const HELP_TEXT = [
  '*Samudaya* — here’s what I can do:',
  '',
  '• *notices* — latest announcements',
  '• *report <what’s wrong>* — raise a service request',
  '• *status* — your open requests',
  '• *visitor <name>* — create a gate pass',
  '• *dues* — your outstanding bills',
  '• *amenities* — what you can book',
  '• *link <code>* — connect this number to your account',
  '• *stop* — stop receiving messages',
].join('\n');

export const NOT_LINKED_TEXT = [
  'This number isn’t linked to a Samudaya account yet.',
  '',
  'Open the app, go to *Settings → WhatsApp*, and send me the code it shows:',
  '`link ABC123`',
].join('\n');

export const UNKNOWN_TEXT = 'Sorry, I didn’t understand that. Send *help* to see what I can do.';
