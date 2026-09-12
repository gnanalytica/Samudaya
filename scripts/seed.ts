/**
 * Fills a Supabase project with a small demo community so the app has
 * something to show on first run.
 *
 * Uses the service role, which bypasses row-level security — that is the point
 * here (it has to create users and back-date data), and also why this must only
 * ever be pointed at a development project.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm db:seed
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import type { Database } from '../packages/supabase/src/database.types';

config({ path: 'apps/web/.env.local' });
config({ path: '.env' });

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local works).',
  );
  process.exit(1);
}

if (url.includes('placeholder')) {
  console.error('That looks like the placeholder URL. Point this at a real dev project.');
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PEOPLE = [
  { email: 'asha@example.com', name: 'Asha Menon', role: 'owner' as const },
  { email: 'bala@example.com', name: 'Bala Krishnan', role: 'admin' as const },
  { email: 'chitra@example.com', name: 'Chitra Rao', role: 'resident' as const },
  { email: 'dev@example.com', name: 'Dev Sharma', role: 'resident' as const },
  { email: 'esha@example.com', name: 'Esha Patil', role: 'security' as const },
];

/** Creates the user if missing; returns the id either way, so this is re-runnable. */
async function ensureUser(email: string, name: string): Promise<string> {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (created?.user) return created.user.id;

  // Already there: find them rather than failing the whole seed.
  if (error?.message?.match(/already|registered|exists/i)) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
    const found = list?.users.find((user) => user.email === email);
    if (found) return found.id;
  }
  throw error ?? new Error(`Could not create ${email}`);
}

async function main() {
  console.log('▸ creating demo users');
  const ids = new Map<string, string>();
  for (const person of PEOPLE) {
    ids.set(person.email, await ensureUser(person.email, person.name));
    console.log(`   ${person.email}`);
  }

  const ownerId = ids.get('asha@example.com')!;

  console.log('▸ creating the community');
  const { data: community, error: communityError } = await db
    .from('communities')
    .upsert(
      {
        slug: 'green-valley',
        name: 'Green Valley Apartments',
        city: 'Bengaluru',
        created_by: ownerId,
      },
      { onConflict: 'slug' },
    )
    .select()
    .single();

  if (communityError || !community) throw communityError;

  // The trigger seeds the founder as owner only on INSERT, so an upsert onto an
  // existing row needs the membership ensured explicitly.
  await db
    .from('memberships')
    .upsert(
      { community_id: community.id, user_id: ownerId, role: 'owner', status: 'active' },
      { onConflict: 'community_id,user_id' },
    );

  console.log('▸ adding units');
  const unitRows = [
    ...['101', '102', '201', '202'].map((number) => ({ block: 'A', number })),
    ...['101', '102', '201'].map((number) => ({ block: 'B', number })),
  ].map((unit) => ({ ...unit, community_id: community.id, monthly_dues: 3500 }));

  await db.from('units').upsert(unitRows, {
    onConflict: 'community_id,block,number',
    ignoreDuplicates: true,
  });

  const { data: units } = await db
    .from('units')
    .select('id, block, number')
    .eq('community_id', community.id)
    .order('block')
    .order('number');

  console.log('▸ adding members');
  for (const person of PEOPLE.slice(1)) {
    await db.from('memberships').upsert(
      {
        community_id: community.id,
        user_id: ids.get(person.email)!,
        role: person.role,
        status: 'active',
      },
      { onConflict: 'community_id,user_id' },
    );
  }

  const { data: memberships } = await db
    .from('memberships')
    .select('id, user_id, role')
    .eq('community_id', community.id);

  const membershipFor = (email: string) =>
    memberships?.find((m) => m.user_id === ids.get(email))?.id ?? null;

  // Seat the two residents in flats so they have dues and can raise tickets.
  const seats: [string, number][] = [
    ['chitra@example.com', 0],
    ['dev@example.com', 1],
  ];
  for (const [email, index] of seats) {
    const unit = units?.[index];
    const membershipId = membershipFor(email);
    if (!unit || !membershipId) continue;
    await db.from('unit_occupants').upsert(
      {
        unit_id: unit.id,
        membership_id: membershipId,
        relation: 'owner',
        is_primary: true,
        moved_in_on: new Date().toISOString().slice(0, 10),
      },
      { onConflict: 'unit_id,membership_id', ignoreDuplicates: true },
    );
  }

  console.log('▸ posting notices');
  await db.from('announcements').insert([
    {
      community_id: community.id,
      author_id: membershipFor('asha@example.com'),
      title: 'Water tank cleaning this Saturday',
      body: 'Supply will be off from 10am to 2pm. Please store what you need.',
      audience: 'all',
      is_pinned: true,
    },
    {
      community_id: community.id,
      author_id: membershipFor('bala@example.com'),
      title: 'Diwali celebration — volunteers wanted',
      body: 'We are planning a get-together in the clubhouse. Reply if you can help.',
      audience: 'residents',
    },
  ]);

  console.log('▸ raising a couple of requests');
  await db.from('service_requests').insert([
    {
      community_id: community.id,
      unit_id: units?.[0]?.id ?? null,
      raised_by: membershipFor('chitra@example.com'),
      category: 'plumbing',
      priority: 'high',
      title: 'Leaking tap in the kitchen',
      description: 'Dripping since Monday and getting worse.',
    },
    {
      community_id: community.id,
      unit_id: units?.[1]?.id ?? null,
      raised_by: membershipFor('dev@example.com'),
      category: 'common_area',
      title: 'Corridor light out on the second floor',
      status: 'in_progress',
    },
  ]);

  console.log('▸ adding amenities');
  await db.from('amenities').upsert(
    [
      { community_id: community.id, name: 'Clubhouse', capacity: 60, booking_fee: 500 },
      { community_id: community.id, name: 'Tennis court', capacity: 4 },
      { community_id: community.id, name: 'Party lawn', capacity: 100, requires_approval: true },
    ],
    { onConflict: 'community_id,name', ignoreDuplicates: true },
  );

  console.log('▸ raising an invoice');
  const { data: invoice } = await db
    .from('invoices')
    .insert({
      community_id: community.id,
      unit_id: units?.[0]?.id ?? '',
      title: 'Maintenance — this month',
      status: 'issued',
    })
    .select('id')
    .single();

  if (invoice) {
    await db.from('invoice_items').insert([
      { invoice_id: invoice.id, description: 'Monthly maintenance', quantity: 1, unit_price: 3500 },
      { invoice_id: invoice.id, description: 'Water charges', quantity: 1, unit_price: 450 },
    ]);
  }

  console.log('▸ minting an invite code');
  const { data: code } = await db
    .from('invite_codes')
    .insert({
      community_id: community.id,
      code: 'DEMO2345',
      label: 'Seeded demo code',
      role: 'resident',
      max_uses: 25,
      created_by: ownerId,
    })
    .select('code')
    .single();

  console.log('\n✓ Seeded “Green Valley Apartments”.');
  console.log('  Sign in with a magic link as any of:');
  for (const person of PEOPLE) console.log(`    ${person.email}  (${person.role})`);
  if (code) console.log(`\n  Or join as a new resident with the code: ${code.code}`);
}

main().catch((error) => {
  console.error('\n✗ Seeding failed:', error?.message ?? error);
  process.exit(1);
});
