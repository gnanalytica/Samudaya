import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@samudaya/supabase';
import {
  HELP_TEXT,
  NOT_LINKED_TEXT,
  UNKNOWN_TEXT,
  formatMoney,
  normalizeInviteCode,
  parseCommand,
  relativeTime,
  ticketRef,
  type InboundMessage,
  type WhatsAppCommand,
} from '@samudaya/core';

/**
 * Turns an inbound WhatsApp message into a reply.
 *
 * Runs with the service role — there is no Supabase session behind a phone
 * number — so every query is scoped explicitly to the community the sender
 * belongs to. `resolveSender` establishes that scope once, and nothing below
 * queries outside it.
 */

type Db = SupabaseClient<Database>;

type Sender = {
  userId: string;
  communityId: string;
  communitySlug: string;
  membershipId: string;
  unitIds: string[];
  currency: string;
};

async function resolveSender(db: Db, phone: string): Promise<Sender | null> {
  const { data: link } = await db
    .from('whatsapp_links')
    .select('user_id, default_community_id, verified_at, opted_out_at')
    .eq('phone', phone)
    .maybeSingle();

  if (!link?.verified_at || link.opted_out_at) return null;

  let query = db
    .from('memberships')
    .select('id, community_id, communities!inner(slug, currency)')
    .eq('user_id', link.user_id)
    .eq('status', 'active');

  if (link.default_community_id) query = query.eq('community_id', link.default_community_id);

  const { data: membership } = await query.limit(1).maybeSingle();
  if (!membership) return null;

  const { data: occupancies } = await db
    .from('unit_occupants')
    .select('unit_id')
    .eq('membership_id', membership.id)
    .is('moved_out_on', null);

  return {
    userId: link.user_id,
    communityId: membership.community_id,
    communitySlug: membership.communities.slug,
    membershipId: membership.id,
    unitIds: (occupancies ?? []).map((row) => row.unit_id),
    currency: membership.communities.currency,
  };
}

/**
 * Links a phone number to an account using the short code the resident
 * generated in the app. One code, one use, fifteen minutes.
 */
async function handleLink(db: Db, phone: string, code: string): Promise<string> {
  const normalized = normalizeInviteCode(code);

  const { data: linkCode } = await db
    .from('whatsapp_link_codes')
    .select('id, user_id, community_id, expires_at, consumed_at')
    .eq('code', normalized)
    .maybeSingle();

  if (!linkCode) {
    return 'That code isn’t right. Open the app → Settings → WhatsApp for a fresh one.';
  }
  if (linkCode.consumed_at) return 'That code has already been used. Generate a new one.';
  if (new Date(linkCode.expires_at) <= new Date()) {
    return 'That code has expired. Generate a new one in the app.';
  }

  const { error } = await db.from('whatsapp_links').upsert(
    {
      phone,
      user_id: linkCode.user_id,
      default_community_id: linkCode.community_id,
      verified_at: new Date().toISOString(),
      opted_out_at: null,
    },
    { onConflict: 'phone' },
  );

  if (error) return 'Something went wrong linking this number. Please try again.';

  await db
    .from('whatsapp_link_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', linkCode.id);

  return `This number is linked. ${HELP_TEXT}`;
}

async function handleNotices(db: Db, sender: Sender): Promise<string> {
  const now = new Date().toISOString();
  const { data } = await db
    .from('announcements')
    .select('title, body, published_at')
    .eq('community_id', sender.communityId)
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(3);

  if (!data?.length) return 'No notices right now.';

  return data
    .map(
      (notice) =>
        `*${notice.title}*\n${notice.body.slice(0, 400)}\n_${relativeTime(notice.published_at)}_`,
    )
    .join('\n\n');
}

async function handleReport(db: Db, sender: Sender, text: string): Promise<string> {
  // The first line becomes the title; anything after it is the detail.
  const title = text.split('\n')[0]!.slice(0, 160);

  const { data, error } = await db
    .from('service_requests')
    .insert({
      community_id: sender.communityId,
      unit_id: sender.unitIds[0] ?? null,
      raised_by: sender.membershipId,
      title,
      description: text.length > title.length ? text : null,
      channel: 'whatsapp',
    })
    .select('ticket_no')
    .single();

  if (error || !data) return 'I couldn’t file that just now. Please try again.';

  return (
    `Logged as *${ticketRef(data.ticket_no)}*.\n` +
    'The committee can see it now. Send *status* to check on it.'
  );
}

async function handleStatus(db: Db, sender: Sender): Promise<string> {
  const { data } = await db
    .from('service_requests')
    .select('ticket_no, title, status')
    .eq('community_id', sender.communityId)
    .eq('raised_by', sender.membershipId)
    .in('status', ['open', 'acknowledged', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data?.length) return 'You have no open requests.';

  return (
    'Your open requests:\n\n' +
    data
      .map(
        (row) => `*${ticketRef(row.ticket_no)}* — ${row.title}\n_${row.status.replace('_', ' ')}_`,
      )
      .join('\n\n')
  );
}

async function handleVisitor(db: Db, sender: Sender, name: string): Promise<string> {
  const now = new Date();
  const { data, error } = await db
    .from('visitor_passes')
    .insert({
      community_id: sender.communityId,
      unit_id: sender.unitIds[0] ?? null,
      created_by: sender.membershipId,
      visitor_name: name.slice(0, 120),
      kind: 'guest',
      expected_at: now.toISOString(),
      valid_until: new Date(now.getTime() + 12 * 3_600_000).toISOString(),
      channel: 'whatsapp',
    })
    .select('pass_code, visitor_name')
    .single();

  if (error || !data) return 'I couldn’t create that pass. Please try again.';

  return (
    `Gate pass for *${data.visitor_name}*: *${data.pass_code}*\n` +
    'Valid for 12 hours. Ask them to read the code out at the gate.'
  );
}

async function handleDues(db: Db, sender: Sender): Promise<string> {
  if (sender.unitIds.length === 0)
    return 'No flat is linked to your account, so there are no bills.';

  const { data } = await db
    .from('invoices')
    .select('number, title, balance_due, due_date, status')
    .eq('community_id', sender.communityId)
    .in('unit_id', sender.unitIds)
    .in('status', ['issued', 'partly_paid', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(5);

  if (!data?.length) return 'Nothing outstanding — you’re all settled up.';

  const total = data.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  return (
    `Outstanding: *${formatMoney(total, sender.currency)}*\n\n` +
    data
      .map(
        (invoice) =>
          `${invoice.title} — ${formatMoney(invoice.balance_due, sender.currency)} (due ${invoice.due_date})`,
      )
      .join('\n')
  );
}

async function handleAmenities(db: Db, sender: Sender): Promise<string> {
  const { data } = await db
    .from('amenities')
    .select('name, opens_at, closes_at')
    .eq('community_id', sender.communityId)
    .eq('is_active', true)
    .order('name')
    .limit(10);

  if (!data?.length) return 'No amenities are set up yet.';

  return (
    'Bookable in your community:\n\n' +
    data
      .map((a) => `• *${a.name}* (${a.opens_at.slice(0, 5)}–${a.closes_at.slice(0, 5)})`)
      .join('\n') +
    '\n\nBooking a slot needs the app — WhatsApp can’t show you a calendar.'
  );
}

async function handleStop(db: Db, phone: string): Promise<string> {
  await db
    .from('whatsapp_links')
    .update({ opted_out_at: new Date().toISOString() })
    .eq('phone', phone);

  return 'Done — I won’t message this number again. Send *start* any time to turn it back on.';
}

/**
 * Decides the reply for one inbound message. Pure dispatch: the caller owns
 * logging and sending.
 */
export async function replyTo(db: Db, message: InboundMessage): Promise<string> {
  const command: WhatsAppCommand = parseCommand(message.text);
  const phone = message.from;

  // Linking and opting out are the only things an unlinked number may do.
  if (command.kind === 'link') return handleLink(db, phone, command.code);
  if (command.kind === 'stop') return handleStop(db, phone);

  const sender = await resolveSender(db, phone);
  if (!sender) return NOT_LINKED_TEXT;

  switch (command.kind) {
    case 'help':
      return HELP_TEXT;
    case 'notices':
      return handleNotices(db, sender);
    case 'report':
      return handleReport(db, sender, command.text);
    case 'status':
      return handleStatus(db, sender);
    case 'visitor':
      return handleVisitor(db, sender, command.name);
    case 'dues':
      return handleDues(db, sender);
    case 'amenities':
      return handleAmenities(db, sender);
    case 'empty':
      return HELP_TEXT;
    default:
      return UNKNOWN_TEXT;
  }
}

export { resolveSender };
