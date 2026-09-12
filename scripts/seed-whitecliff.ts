/**
 * Fills an existing community with a believable, clearly fictional society
 * modelled on Sraddha White Cliff, Seegehalli (Bengaluru): two towers, 220
 * 2 and 3 BHK flats, clubhouse, pool, courts. Residents, money and events are
 * invented; nothing here describes real people.
 *
 * Every demo account uses an `@demo.samudaya.test` address (a reserved,
 * undeliverable domain) and `user_metadata.demo = true`, so `--clean` can find
 * and remove exactly what this script added while keeping the community and
 * its real owner.
 *
 *   tsx scripts/seed-whitecliff.ts [community-slug]           # seed
 *   tsx scripts/seed-whitecliff.ts [community-slug] --clean   # remove demo data
 *
 * Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 * The service role bypasses row-level security, so point it only at a project
 * you mean to change.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../packages/supabase/src/database.types';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const SLUG = args.find((arg) => !arg.startsWith('--')) ?? 'shraddha-whitecliff';
const DEMO_DOMAIN = 'demo.samudaya.test';

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Role = 'resident' | 'committee' | 'admin';

/** Fictional residents. `title` only shapes the story; `role` is what the app enforces. */
const PEOPLE: { name: string; role: Role; title?: string; tenant?: boolean }[] = [
  { name: 'Ramesh Gowda', role: 'admin', title: 'Association Secretary' },
  { name: 'Lakshmi Narayanan', role: 'admin', title: 'Treasurer' },
  { name: 'Priya Hegde', role: 'committee', title: 'Cultural Committee lead' },
  { name: 'Arjun Reddy', role: 'committee', title: 'Sports Committee lead' },
  { name: 'Fatima Sheikh', role: 'committee', title: 'Facilities' },
  { name: 'Joseph Mathew', role: 'committee', title: 'Security & safety' },
  { name: 'Kavya Shetty', role: 'resident' },
  { name: 'Vikram Malhotra', role: 'resident', tenant: true },
  { name: 'Ananya Iyer', role: 'resident' },
  { name: 'Suresh Kumar', role: 'resident' },
  { name: 'Deepa Nair', role: 'resident' },
  { name: 'Rahul Verma', role: 'resident', tenant: true },
  { name: 'Meera Rao', role: 'resident' },
  { name: 'Karthik Subramanian', role: 'resident' },
  { name: 'Neha Agarwal', role: 'resident', tenant: true },
  { name: 'Manjunath B', role: 'resident' },
  { name: 'Shalini Pillai', role: 'resident' },
  { name: 'Aditya Joshi', role: 'resident' },
  { name: 'Sowmya Prakash', role: 'resident' },
  { name: 'Imran Khan', role: 'resident', tenant: true },
  { name: 'Divya Menon', role: 'resident' },
  { name: 'Harish Bhat', role: 'resident' },
  { name: 'Pooja Sinha', role: 'resident', tenant: true },
  { name: 'Naveen Chandra', role: 'resident' },
  { name: 'Rekha Srinivas', role: 'resident' },
  { name: 'Siddharth Kulkarni', role: 'resident' },
  { name: 'Anjali Das', role: 'resident', tenant: true },
  { name: 'Prakash Murthy', role: 'resident' },
  { name: 'Swathi Raghavan', role: 'resident' },
  { name: 'Gaurav Mehta', role: 'resident' },
  { name: 'Bhavana Kamath', role: 'resident' },
  { name: 'Thomas George', role: 'resident' },
];

const emailFor = (name: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '')}@${DEMO_DOMAIN}`;

const DAY = 86_400_000;
const date = (iso: string) => iso.slice(0, 10);
const at = (iso: string) => new Date(iso).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Deterministic pseudo-random so re-running produces the same society. */
let seed = 20260913;
const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;

/**
 * Throws on a query error. Callers only use the returned data after a
 * `.select()`, where a successful query always has rows or a row.
 */
function check<T>(
  label: string,
  result: { data: T; error: { message: string } | null },
): NonNullable<T> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

async function listDemoUsers() {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.filter((user) => user.email?.endsWith(`@${DEMO_DOMAIN}`)));
    if (data.users.length < 200) return users;
  }
}

async function findCommunity() {
  const community = check(
    'find community',
    await db.from('communities').select('id, name, created_by').eq('slug', SLUG).maybeSingle(),
  );
  if (!community) throw new Error(`No community with slug "${SLUG}".`);
  return community;
}

async function clean() {
  const community = await findCommunity();
  const where = { community_id: community.id } as const;
  console.log(`▸ removing demo data from “${community.name}”`);

  // Events cascade to tasks, activities, roles, sign-ups, contributions and
  // expenses. Reallocations reference events, so they go first.
  for (const table of [
    'fund_reallocations',
    'polls',
    'announcements',
    'activity_suggestions',
    'invite_codes',
    'join_requests',
    'events',
  ] as const) {
    check(`clear ${table}`, await db.from(table).delete().match(where));
    console.log(`   ${table}`);
  }
  check('clear units', await db.from('units').delete().match(where));
  console.log('   units');

  const demo = await listDemoUsers();
  for (const user of demo) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`delete ${user.email}: ${error.message}`);
  }
  console.log(`   ${demo.length} demo accounts`);
  console.log('\n✓ Demo data removed. The community and its owner are untouched.');
}

async function seedSociety() {
  const community = await findCommunity();
  const existingEvents = check(
    'count events',
    await db.from('events').select('id').eq('community_id', community.id),
  );
  if (existingEvents.length) {
    throw new Error(
      `“${community.name}” already has ${existingEvents.length} event(s). Run with --clean first.`,
    );
  }
  const cid = community.id;
  console.log(`▸ seeding “${community.name}” (${SLUG})`);

  check(
    'describe community',
    await db
      .from('communities')
      .update({ city: 'Bengaluru', timezone: 'Asia/Kolkata', currency: 'INR' })
      .eq('id', cid),
  );

  // ── Flats: 2 towers × 11 floors × 10 flats = 220 ───────────────────────────
  console.log('▸ adding 220 flats across Tower A and Tower B');
  const unitRows = ['A', 'B'].flatMap((block) =>
    Array.from({ length: 11 }, (_, f) => f + 1).flatMap((floor) =>
      Array.from({ length: 10 }, (_, i) => i + 1).map((flat) => {
        const threeBhk = flat <= 4; // corner and park-facing stacks are 3 BHK
        return {
          community_id: cid,
          block,
          floor,
          number: `${floor}${String(flat).padStart(2, '0')}`,
          bedrooms: threeBhk ? 3 : 2,
          area_sqft: threeBhk ? pick([1515, 1680, 1840, 2075]) : pick([1140, 1185, 1230]),
        };
      }),
    ),
  );
  const units = check(
    'insert units',
    await db.from('units').insert(unitRows).select('id, block, number'),
  );

  // ── People ─────────────────────────────────────────────────────────────────
  console.log(`▸ creating ${PEOPLE.length} fictional residents`);
  const shuffledUnits = [...units].sort(() => rand() - 0.5);
  const members: {
    name: string;
    role: Role;
    title?: string;
    membershipId: string;
    unitId: string;
  }[] = [];
  for (const [index, person] of PEOPLE.entries()) {
    const { data, error } = await db.auth.admin.createUser({
      email: emailFor(person.name),
      email_confirm: true,
      user_metadata: { full_name: person.name, demo: true },
    });
    if (error || !data.user) throw new Error(`create ${person.name}: ${error?.message}`);

    const membership = check(
      `membership ${person.name}`,
      await db
        .from('memberships')
        .insert({
          community_id: cid,
          user_id: data.user.id,
          role: person.role,
          status: 'active',
          joined_at: daysAgo(120 - index * 3),
        })
        .select('id')
        .single(),
    );
    const unit = shuffledUnits[index]!;
    check(
      `seat ${person.name}`,
      await db.from('unit_occupants').insert({
        unit_id: unit.id,
        membership_id: membership.id,
        relation: person.tenant ? 'tenant' : 'owner',
        is_primary: true,
        moved_in_on: date(daysAgo(400 + index * 37)),
      }),
    );
    members.push({ ...person, membershipId: membership.id, unitId: unit.id });
  }

  const by = (name: string) => members.find((m) => m.name === name)!;
  const secretary = by('Ramesh Gowda');
  const treasurer = by('Lakshmi Narayanan');
  const cultural = by('Priya Hegde');
  const sports = by('Arjun Reddy');
  const facilities = by('Fatima Sheikh');
  const security = by('Joseph Mathew');
  const residents = members.filter((m) => m.role === 'resident');

  // ── Helpers for an event's contents ─────────────────────────────────────────
  async function addTasks(eventId: string, tasks: [string, string, string, Role | string][]) {
    check(
      'tasks',
      await db.from('event_tasks').insert(
        tasks.map(([name, status, due, owner], position) => ({
          event_id: eventId,
          community_id: cid,
          name,
          status: status as 'todo' | 'in_progress' | 'done' | 'blocked',
          due_on: due,
          position,
          assignee_id: by(owner).membershipId,
        })),
      ),
    );
  }

  async function addContributions(
    eventId: string,
    count: number,
    amounts: number[],
    from: string,
    to: string,
    offlineFlats = 0,
  ) {
    const start = new Date(from).getTime();
    const span = new Date(to).getTime() - start;
    const givers = [...members].sort(() => rand() - 0.5).slice(0, count);
    // Most flats in a real society never open the app: they pay the treasurer
    // by UPI or cash and get recorded against their flat with no member.
    const offline = shuffledUnits
      .slice(PEOPLE.length + 3)
      .sort(() => rand() - 0.5)
      .slice(0, offlineFlats)
      .map((unit) => ({
        event_id: eventId,
        community_id: cid,
        membership_id: null,
        unit_id: unit.id,
        amount: pick(amounts),
        method: rand() < 0.6 ? ('upi' as const) : ('cash' as const),
        status: 'succeeded' as const,
        channel: 'system' as const,
        reference: null,
        paid_at: new Date(start + rand() * span).toISOString(),
      }));
    const rows = givers.map((member) => {
      const method =
        rand() < 0.82 ? ('upi' as const) : pick(['cash', 'bank_transfer', 'cheque'] as const);
      return {
        event_id: eventId,
        community_id: cid,
        membership_id: member.membershipId,
        unit_id: member.unitId,
        amount: pick(amounts),
        method,
        status: 'succeeded' as const,
        channel: pick(['web', 'mobile', 'mobile', 'whatsapp'] as const),
        reference:
          method === 'upi'
            ? `UPI${Math.floor(rand() * 1e12)
                .toString()
                .padStart(12, '0')}`
            : null,
        paid_at: new Date(start + rand() * span).toISOString(),
      };
    });
    const all = [...rows, ...offline];
    check('contributions', await db.from('contributions').insert(all));
    return { raised: all.reduce((sum, row) => sum + row.amount, 0), contributors: all.length };
  }

  type ExpenseLine = [string, string, number, string, 'approved' | 'pending' | 'rejected', string];
  async function addExpenses(eventId: string, lines: ExpenseLine[], requester = cultural) {
    for (const [name, category, amount, vendor, status, spentOn] of lines) {
      check(
        `expense ${name}`,
        await db.from('expenses').insert({
          event_id: eventId,
          community_id: cid,
          name,
          category,
          amount,
          vendor,
          method: 'upi',
          spent_on: spentOn,
          bill_url: `bills/${eventId.slice(0, 8)}/${name.toLowerCase().replace(/[^a-z]+/g, '-')}.pdf`,
          requested_by: requester.membershipId,
          paid_by: requester.membershipId,
          status,
          approved_by: status === 'approved' ? treasurer.membershipId : null,
          approved_at: status === 'approved' ? at(`${spentOn}T18:30:00+05:30`) : null,
          review_note:
            status === 'rejected'
              ? 'Quote is higher than the budget line; please get two more.'
              : null,
        }),
      );
    }
    return lines.filter((l) => l[4] === 'approved').reduce((sum, l) => sum + l[2], 0);
  }

  async function addActivities(
    eventId: string,
    items: { name: string; emoji: string; description: string; capacity?: number }[],
    coordinator: typeof cultural,
    signUps: number,
  ) {
    const rows = check(
      'activities',
      await db
        .from('event_activities')
        .insert(
          items.map((item, position) => ({
            ...item,
            event_id: eventId,
            community_id: cid,
            position,
            coordinator_id: coordinator.membershipId,
          })),
        )
        .select('id'),
    );
    const pairs = new Set<string>();
    const participants = [];
    for (let i = 0; i < signUps; i += 1) {
      const activity = pick(rows);
      const member = pick(members);
      const key = `${activity.id}:${member.membershipId}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      participants.push({
        activity_id: activity.id,
        membership_id: member.membershipId,
        age_group: pick(['Kids (5–12)', 'Teens', 'Adults', 'Seniors']),
        experience: pick(['First time', 'Some experience', 'Performed before']),
        channel: pick(['web', 'mobile', 'whatsapp'] as const),
      });
    }
    if (participants.length) {
      check('participants', await db.from('activity_participants').insert(participants));
    }
    return participants.length;
  }

  async function addVolunteers(
    eventId: string,
    items: { name: string; emoji: string; target_count: number }[],
    coordinator: typeof cultural,
    signUps: number,
  ) {
    const rows = check(
      'volunteer roles',
      await db
        .from('volunteer_roles')
        .insert(
          items.map((item, position) => ({
            ...item,
            event_id: eventId,
            community_id: cid,
            position,
            coordinator_id: coordinator.membershipId,
          })),
        )
        .select('id'),
    );
    const pairs = new Set<string>();
    const volunteers = [];
    for (let i = 0; i < signUps; i += 1) {
      const role = pick(rows);
      const member = pick(members);
      const key = `${role.id}:${member.membershipId}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      volunteers.push({
        role_id: role.id,
        membership_id: member.membershipId,
        channel: pick(['web', 'mobile', 'whatsapp'] as const),
      });
    }
    if (volunteers.length)
      check('volunteers', await db.from('event_volunteers').insert(volunteers));
    return volunteers.length;
  }

  async function createEvent(
    row: Omit<Database['public']['Tables']['events']['Insert'], 'community_id'>,
  ) {
    return check(
      `event ${row.name}`,
      await db
        .from('events')
        .insert({ created_by: community.created_by, ...row, community_id: cid })
        .select('id, name')
        .single(),
    );
  }

  // ── 1. Independence Day — done and closed ──────────────────────────────────
  console.log('▸ Independence Day 2026 (completed, report published)');
  const iday = await createEvent({
    slug: 'independence-day-2026',
    emoji: '🇮🇳',
    name: 'Independence Day 2026',
    starts_on: '2026-08-15',
    venue: 'Central lawn, between Tower A and Tower B',
    organizer: 'Whitecliff Residents Welfare Association',
    description:
      'Flag hoisting at 8 am, kids’ fancy dress and patriotic songs, followed by breakfast for everyone at the clubhouse.',
    status: 'published',
    expected_attendance: 260,
    fund_target: 30000,
    fund_rule: 'carry_next_edition',
    fund_rule_note: 'Any surplus goes to Independence Day 2027.',
  });
  await addTasks(iday.id, [
    ['Order flag, pole rope and flowers', 'done', '2026-08-10', 'Joseph Mathew'],
    ['Book breakfast caterer', 'done', '2026-08-08', 'Priya Hegde'],
    ['Sound system and mic for anthem', 'done', '2026-08-12', 'Fatima Sheikh'],
    ['Fancy dress registrations', 'done', '2026-08-13', 'Priya Hegde'],
    ['Certificates and prizes for kids', 'done', '2026-08-14', 'Kavya Shetty'],
    ['Post-event cleanup', 'done', '2026-08-15', 'Fatima Sheikh'],
  ]);
  const idayFund = await addContributions(
    iday.id,
    24,
    [500, 1000, 1001, 1500, 2000],
    '2026-07-25T09:00:00+05:30',
    '2026-08-14T21:00:00+05:30',
  );
  const idaySpent = await addExpenses(iday.id, [
    ['Breakfast for 250', 'food', 16250, 'Sri Krishna Caterers', 'approved', '2026-08-15'],
    [
      'Flag, flowers and decoration',
      'decoration',
      3400,
      'Kadugodi Flower Market',
      'approved',
      '2026-08-14',
    ],
    ['Sound system rental', 'sound', 2500, 'Whitefield Sound & Lights', 'approved', '2026-08-15'],
    ['Prizes and certificates', 'prizes', 2150, 'Sapna Book House', 'approved', '2026-08-14'],
  ]);
  const idayParticipants = await addActivities(
    iday.id,
    [
      {
        name: 'Kids fancy dress',
        emoji: '🧒',
        description: 'Freedom fighters and national symbols.',
      },
      {
        name: 'Patriotic songs',
        emoji: '🎤',
        description: 'Group singing after the flag hoisting.',
      },
    ],
    cultural,
    18,
  );
  const idayVolunteers = await addVolunteers(
    iday.id,
    [
      { name: 'Seating & setup', emoji: '🪑', target_count: 6 },
      { name: 'Breakfast counters', emoji: '🍽️', target_count: 5 },
    ],
    security,
    10,
  );

  // ── 2. Ganesh Chaturthi — happening now ────────────────────────────────────
  console.log('▸ Ganesh Chaturthi 2026 (live, fund part-raised)');
  const ganesh = await createEvent({
    slug: 'ganesh-chaturthi-2026',
    emoji: '🪔',
    name: 'Ganesh Chaturthi 2026',
    starts_on: '2026-09-14',
    ends_on: '2026-09-16',
    venue: 'Clubhouse amphitheatre',
    organizer: 'Cultural Committee',
    description:
      'Three days with an eco-friendly clay idol: daily pooja and aarti, cultural evenings, a community lunch on day two, and visarjan in the portable tank near the clubhouse.',
    status: 'published',
    expected_attendance: 450,
    fund_target: 185000,
    fund_rule: 'carry_next_edition',
    fund_rule_note: 'Surplus is carried to Ganesh Chaturthi 2027.',
  });
  await addTasks(ganesh.id, [
    ['Book clay idol (eco-friendly, 4 ft)', 'done', '2026-08-25', 'Priya Hegde'],
    ['Pandal and stage at the amphitheatre', 'done', '2026-09-10', 'Fatima Sheikh'],
    ['Confirm priest for all three days', 'done', '2026-09-01', 'Ramesh Gowda'],
    ['Pooja materials and flowers', 'in_progress', '2026-09-13', 'Priya Hegde'],
    ['Community lunch caterer (500 plates)', 'done', '2026-09-05', 'Lakshmi Narayanan'],
    ['Cultural evening running order', 'in_progress', '2026-09-13', 'Priya Hegde'],
    ['Portable visarjan tank and water', 'in_progress', '2026-09-15', 'Fatima Sheikh'],
    ['Security briefing and visitor passes', 'todo', '2026-09-13', 'Joseph Mathew'],
    ['Parking plan for guests', 'todo', '2026-09-13', 'Joseph Mathew'],
    ['Sound and lighting', 'done', '2026-09-09', 'Arjun Reddy'],
    ['Photographer', 'blocked', '2026-09-12', 'Kavya Shetty'],
    ['Post-festival cleanup crew', 'todo', '2026-09-16', 'Fatima Sheikh'],
  ]);
  await addContributions(
    ganesh.id,
    30,
    [1001, 1001, 2001, 2500, 3001, 5001, 1500],
    '2026-08-20T09:00:00+05:30',
    '2026-09-13T11:00:00+05:30',
    25,
  );
  await addExpenses(ganesh.id, [
    ['Clay idol and transport', 'idol', 28000, 'Kumbarapete Idol Makers', 'approved', '2026-09-08'],
    ['Pandal, stage and chairs', 'decoration', 42000, 'Shubh Tent House', 'approved', '2026-09-10'],
    [
      'Sound and lighting (3 days)',
      'sound',
      18500,
      'Whitefield Sound & Lights',
      'approved',
      '2026-09-09',
    ],
    ['Community lunch advance', 'food', 25000, 'Sri Krishna Caterers', 'approved', '2026-09-06'],
    ['Flowers and pooja materials', 'pooja', 9800, 'KR Market Traders', 'pending', '2026-09-12'],
    ['Portable visarjan tank', 'visarjan', 7500, 'Eco Visarjan Services', 'pending', '2026-09-12'],
    [
      'LED wall for cultural evenings',
      'sound',
      36000,
      'Stagecraft Events',
      'rejected',
      '2026-09-07',
    ],
  ]);
  await addActivities(
    ganesh.id,
    [
      {
        name: 'Bharatanatyam',
        emoji: '💃',
        description: 'Solo and group items, day one.',
        capacity: 16,
      },
      { name: 'Bhajans', emoji: '🎶', description: 'Evening bhajans with harmonium and tabla.' },
      {
        name: 'Kids skit: Ganesha stories',
        emoji: '🎭',
        description: 'Ages 6–12, two rehearsals.',
        capacity: 20,
      },
      {
        name: 'Rangoli competition',
        emoji: '🎨',
        description: 'Teams of two, clubhouse foyer.',
        capacity: 24,
      },
      { name: 'Antakshari', emoji: '🎤', description: 'Tower A vs Tower B.' },
    ],
    cultural,
    46,
  );
  await addVolunteers(
    ganesh.id,
    [
      { name: 'Pooja & prasad', emoji: '🙏', target_count: 6 },
      { name: 'Lunch serving', emoji: '🍛', target_count: 12 },
      { name: 'Stage & sound', emoji: '🎚️', target_count: 4 },
      { name: 'Visarjan crew', emoji: '💧', target_count: 8 },
      { name: 'Cleanup', emoji: '🧹', target_count: 10 },
    ],
    cultural,
    30,
  );

  // ── 3. Whitecliff Premier League — sign-ups open ────────────────────────────
  console.log('▸ Whitecliff Premier League (sports weekend, sign-ups open)');
  const wpl = await createEvent({
    slug: 'whitecliff-premier-league-2026',
    emoji: '🏸',
    name: 'Whitecliff Premier League 2026',
    starts_on: '2026-10-10',
    ends_on: '2026-10-11',
    venue: 'Badminton court, basketball court and jogging track',
    organizer: 'Sports Committee',
    description:
      'Badminton doubles, box cricket on the basketball court, a 3 km run on the jogging track and kids’ races. Tower teams, medals for all finishers.',
    status: 'published',
    expected_attendance: 180,
    fund_target: 45000,
    fund_rule: 'general_fund',
  });
  await addTasks(wpl.id, [
    ['Fixtures and brackets', 'in_progress', '2026-10-03', 'Arjun Reddy'],
    ['Shuttlecocks, balls and stumps', 'todo', '2026-10-05', 'Arjun Reddy'],
    ['Medals and trophies', 'todo', '2026-10-06', 'Siddharth Kulkarni'],
    ['First-aid desk', 'todo', '2026-10-09', 'Joseph Mathew'],
    ['Team T-shirts (Tower A blue, Tower B orange)', 'in_progress', '2026-10-01', 'Gaurav Mehta'],
  ]);
  await addContributions(
    wpl.id,
    9,
    [500, 1000, 1000, 2000],
    '2026-09-01T09:00:00+05:30',
    '2026-09-12T21:00:00+05:30',
  );
  await addExpenses(
    wpl.id,
    [
      [
        'Shuttlecock tubes (12)',
        'equipment',
        7200,
        'Decathlon Whitefield',
        'pending',
        '2026-09-11',
      ],
    ],
    sports,
  );
  await addActivities(
    wpl.id,
    [
      {
        name: 'Badminton doubles',
        emoji: '🏸',
        description: 'Men’s, women’s and mixed.',
        capacity: 48,
      },
      { name: 'Box cricket', emoji: '🏏', description: 'Six-a-side, tower teams.', capacity: 36 },
      { name: '3 km fun run', emoji: '🏃', description: 'Four laps of the jogging track.' },
      { name: 'Kids races', emoji: '🧒', description: 'Sack race, lemon-and-spoon, 50 m.' },
    ],
    sports,
    40,
  );
  await addVolunteers(
    wpl.id,
    [
      { name: 'Umpires & scorers', emoji: '📋', target_count: 6 },
      { name: 'Water & first aid', emoji: '🩹', target_count: 4 },
    ],
    sports,
    7,
  );

  // ── 4. Deepavali — fund just opened ────────────────────────────────────────
  console.log('▸ Deepavali Habba 2026 (announced, collecting)');
  const deepavali = await createEvent({
    slug: 'deepavali-2026',
    emoji: '✨',
    name: 'Deepavali Habba 2026',
    starts_on: '2026-11-07',
    venue: 'Clubhouse party area and poolside',
    organizer: 'Cultural Committee',
    description:
      'Diya lighting around the pool, a rangoli walk through both towers, sweets exchange and a green-crackers-only window from 7 to 9 pm.',
    status: 'published',
    expected_attendance: 400,
    fund_target: 120000,
    fund_rule: 'carry_related',
    fund_rule_note: 'Surplus goes towards the New Year’s Eve party.',
  });
  await addTasks(deepavali.id, [
    ['Poll residents on crackers policy', 'done', '2026-09-10', 'Ramesh Gowda'],
    ['Diyas, oil and wicks (1,000)', 'todo', '2026-10-25', 'Priya Hegde'],
    ['Sweets vendor tasting', 'todo', '2026-10-20', 'Meera Rao'],
    ['Fire safety plan with security', 'todo', '2026-10-30', 'Joseph Mathew'],
  ]);
  await addContributions(
    deepavali.id,
    5,
    [1001, 2001],
    '2026-09-08T09:00:00+05:30',
    '2026-09-12T21:00:00+05:30',
  );

  // ── 5. New Year's Eve — still a draft ──────────────────────────────────────
  console.log('▸ New Year’s Eve 2026 (draft)');
  await createEvent({
    slug: 'new-years-eve-2026',
    emoji: '🎆',
    name: 'New Year’s Eve 2026',
    starts_on: '2026-12-31',
    venue: 'Clubhouse terrace',
    organizer: 'Cultural Committee',
    description: 'DJ, dinner buffet and a countdown on the terrace. Details to follow.',
    status: 'draft',
    expected_attendance: 300,
    fund_target: 150000,
    fund_rule: 'general_fund',
  });

  // Close Independence Day last, once its ledger is complete. The summary is
  // built from what was inserted: event_stats filters by the signed-in caller,
  // so under the service role it returns nothing.
  check(
    'close iday',
    await db
      .from('events')
      .update({
        status: 'completed',
        closing_summary: {
          closed_at: at('2026-08-20T20:00:00+05:30'),
          closed_by: secretary.membershipId,
          raised: idayFund.raised,
          spent: idaySpent,
          surplus: idayFund.raised - idaySpent,
          contributors: idayFund.contributors,
          participants: idayParticipants,
          volunteers: idayVolunteers,
          tasks_done: 6,
          tasks_total: 6,
        },
      })
      .eq('id', iday.id),
  );

  // ── Governance: move the Independence Day surplus ──────────────────────────
  console.log('▸ proposal to move the Independence Day surplus, out to vote');
  const surplus = Math.max(1000, Math.floor((idayFund.raised - idaySpent) / 500) * 500);
  const proposal = check(
    'reallocation',
    await db
      .from('fund_reallocations')
      .insert({
        community_id: cid,
        from_event_id: iday.id,
        to_event_id: deepavali.id,
        amount: surplus,
        reason:
          'Independence Day came in under budget. Rather than hold the surplus for a year, use it for diyas and the rangoli walk at Deepavali.',
        threshold_pct: 60,
        status: 'voting',
        closes_at: at('2026-09-20T21:00:00+05:30'),
        created_by: treasurer.membershipId,
      })
      .select('id')
      .single(),
  );
  check(
    'reallocation votes',
    await db.from('reallocation_votes').insert(
      [...members]
        .sort(() => rand() - 0.5)
        .slice(0, 14)
        .map((member) => ({
          reallocation_id: proposal.id,
          membership_id: member.membershipId,
          approve: rand() < 0.78,
          channel: pick(['web', 'mobile', 'whatsapp'] as const),
        })),
    ),
  );

  // ── Notices ────────────────────────────────────────────────────────────────
  console.log('▸ notices, polls and suggestions');
  check(
    'announcements',
    await db.from('announcements').insert(
      [
        {
          community_id: cid,
          event_id: ganesh.id,
          author_id: secretary.membershipId,
          title: 'Ganesh Chaturthi: visitor parking and gate timings',
          body: 'Guests park in the visitor bays near the main gate; basement parking is for residents only. The rear gate stays closed from 6 pm to 10 pm on all three days.',
          is_pinned: true,
          published_at: daysAgo(1),
        },
        {
          community_id: cid,
          author_id: facilities.membershipId,
          title: 'Swimming pool closed Tuesday for filter maintenance',
          body: 'The pool will be drained partially and closed from 7 am to 6 pm on Tuesday. The gym is unaffected.',
          published_at: daysAgo(3),
        },
        {
          community_id: cid,
          author_id: facilities.membershipId,
          title: 'Overhead tank cleaning, Tower B — Saturday 10 am to 2 pm',
          body: 'Water supply to Tower B will be off during cleaning. Please store water on Friday night.',
          published_at: daysAgo(6),
        },
        {
          community_id: cid,
          author_id: security.membershipId,
          title: 'Delivery partners must use the MyGate pass',
          body: 'From Monday, security will not allow deliveries to towers without an approved pass. Leave-at-gate remains available.',
          audience: 'residents',
          published_at: daysAgo(9),
        },
        {
          community_id: cid,
          author_id: treasurer.membershipId,
          title: 'Independence Day accounts are published',
          body: 'The full ledger with bills is on the event page. There is a surplus; see the proposal on how to use it and cast your vote.',
          published_at: daysAgo(20),
        },
        {
          community_id: cid,
          author_id: secretary.membershipId,
          title: 'Committee meeting minutes — August',
          body: 'Summary: STP servicing contract renewed, two new CCTV cameras near the play area, and a proposal to resurface the badminton court before the Premier League.',
          audience: 'committee',
          published_at: daysAgo(24),
        },
        // Rows in one batch omit different columns; let those fall back to
        // their column defaults (audience = 'all') instead of null.
      ],
      { defaultToNull: false },
    ),
  );

  const polls: { question: string; detail: string; event?: string; options: [string, string][] }[] =
    [
      {
        question: 'Crackers at Deepavali: what should our policy be?',
        detail: 'The pets and seniors groups asked for a limited window this year.',
        event: deepavali.id,
        options: [
          ['Green crackers, 7–9 pm only', '🌿'],
          ['No crackers, lights and diyas only', '🪔'],
          ['No restrictions', '🎆'],
        ],
      },
      {
        question: 'Should we resurface the badminton court before the Premier League?',
        detail: 'Estimated cost ₹68,000 from the maintenance corpus.',
        options: [
          ['Yes, before October', '👍'],
          ['After the tournament', '⏳'],
          ['Not needed', '👎'],
        ],
      },
    ];
  for (const poll of polls) {
    const row = check(
      'poll',
      await db
        .from('polls')
        .insert({
          community_id: cid,
          event_id: poll.event ?? null,
          question: poll.question,
          detail: poll.detail,
          created_by: secretary.membershipId,
          closes_at: at('2026-09-25T21:00:00+05:30'),
        })
        .select('id')
        .single(),
    );
    const options = check(
      'poll options',
      await db
        .from('poll_options')
        .insert(
          poll.options.map(([label, emoji], position) => ({
            poll_id: row.id,
            label,
            emoji,
            position,
          })),
        )
        .select('id, position'),
    );
    const weights = [0.58, 0.3, 0.12];
    check(
      'poll votes',
      await db.from('poll_votes').insert(
        [...members]
          .sort(() => rand() - 0.5)
          .slice(0, 22)
          .map((member) => {
            const roll = rand();
            const position = roll < weights[0]! ? 0 : roll < weights[0]! + weights[1]! ? 1 : 2;
            return {
              poll_id: row.id,
              option_id: options.find((o) => o.position === position)!.id,
              membership_id: member.membershipId,
              channel: pick(['web', 'mobile', 'whatsapp'] as const),
            };
          }),
      ),
    );
  }

  const suggestions = check(
    'suggestions',
    await db
      .from('activity_suggestions')
      .insert([
        {
          community_id: cid,
          name: 'Sunday morning yoga by the pool',
          description:
            'A certified instructor lives in Tower A and has offered to lead 6:30 am sessions.',
          expected_participants: 20,
          wants_to_coordinate: true,
          status: 'accepted',
          suggested_by: by('Ananya Iyer').membershipId,
        },
        {
          community_id: cid,
          name: 'Monthly organic farmers’ market',
          description:
            'Invite farmers from Hoskote to set up stalls in the visitor parking once a month.',
          expected_participants: 80,
          wants_to_coordinate: false,
          status: 'reviewing',
          suggested_by: by('Deepa Nair').membershipId,
        },
        {
          community_id: cid,
          name: 'Kids coding and robotics club',
          description: 'Saturday afternoons in the indoor games room, ages 9–14.',
          expected_participants: 15,
          wants_to_coordinate: true,
          status: 'new',
          suggested_by: by('Karthik Subramanian').membershipId,
        },
        {
          community_id: cid,
          name: 'Carrom and chess league for seniors',
          description: 'Weekday evenings in the clubhouse.',
          expected_participants: 12,
          wants_to_coordinate: false,
          status: 'new',
          suggested_by: by('Prakash Murthy').membershipId,
        },
      ])
      .select('id'),
  );
  const interests = suggestions.flatMap((suggestion, i) =>
    residents.slice(i * 3, i * 3 + 6 + i).map((member) => ({
      suggestion_id: suggestion.id,
      membership_id: member.membershipId,
    })),
  );
  check('suggestion interests', await db.from('suggestion_interests').insert(interests));

  // ── Joining: invite codes and people waiting for approval ───────────────────
  console.log('▸ invite codes and pending join requests');
  const freeUnits = shuffledUnits.slice(PEOPLE.length);
  check(
    'invite codes',
    await db.from('invite_codes').insert([
      {
        community_id: cid,
        code: 'WCTOWERA26',
        label: 'Tower A owners (from the WhatsApp group)',
        role: 'resident',
        max_uses: 60,
        used_count: 11,
        expires_at: at('2026-10-31T23:59:00+05:30'),
        created_by: community.created_by,
      },
      {
        community_id: cid,
        code: 'WCTOWERB26',
        label: 'Tower B owners (from the WhatsApp group)',
        role: 'resident',
        max_uses: 60,
        used_count: 8,
        expires_at: at('2026-10-31T23:59:00+05:30'),
        created_by: community.created_by,
      },
      {
        community_id: cid,
        code: 'WCCOMMITTEE',
        label: 'New committee members',
        role: 'committee',
        max_uses: 3,
        used_count: 1,
        created_by: community.created_by,
      },
    ]),
  );

  const waiting = ['Rohan Deshpande', 'Latha Venkatesh', 'Sameer Qureshi'];
  for (const [index, name] of waiting.entries()) {
    const { data, error } = await db.auth.admin.createUser({
      email: emailFor(name),
      email_confirm: true,
      user_metadata: { full_name: name, demo: true },
    });
    if (error || !data.user) throw new Error(`create ${name}: ${error?.message}`);
    check(
      `join request ${name}`,
      await db.from('join_requests').insert({
        community_id: cid,
        user_id: data.user.id,
        unit_id: freeUnits[index]!.id,
        claimed_name: name,
        claimed_phone: `+9198450${String(10000 + index * 7331).slice(0, 5)}`,
        relation: index === 1 ? 'tenant' : 'owner',
        status: 'pending',
      }),
    );
  }

  console.log(`\n✓ Seeded “${community.name}” with fictional data.`);
  console.log(`  220 flats · ${PEOPLE.length} residents · 5 events · 6 notices · 2 polls`);
  console.log('  3 join requests and 2 expenses are waiting for an admin.');
  console.log(`  Remove it all with: tsx scripts/seed-whitecliff.ts ${SLUG} --clean`);
}

(CLEAN ? clean() : seedSociety()).catch((error) => {
  console.error('\n✗', error?.message ?? error);
  process.exit(1);
});
