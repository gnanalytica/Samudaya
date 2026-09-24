import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ClipboardList, MessageCircle, Receipt, Vote, Wallet } from 'lucide-react';
import { todayIn } from '@samudaya/core';
import { ButtonLink } from '@/components/ui/button';
import { Rangoli, festivalVars } from '@/components/festival';
import { DemoVideo } from './demo-video';
import { Garland, Sparkles } from './festive';
import { getCurrentUser } from '@/lib/auth';
import { season } from '@/lib/season';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'One place per event',
    body: 'Ganesh Chaturthi, Dussehra, Diwali, Christmas — each carries its own activities, budget, fund and ledger.',
  },
  {
    icon: ClipboardList,
    title: 'A budget everyone can see',
    body: 'What the committee plans to spend, category by category, next to what was actually spent.',
  },
  {
    // This card used to promise that individual amounts stay private. They do
    // not, deliberately: a confirmed payment is on the society's ledger with the
    // payer's name and flat, as the noticeboard list always had it (see
    // 20260920000500_every_resident_can_see_the_ledger.sql).
    icon: Wallet,
    title: 'A fund with a target',
    body: 'Residents chip in and the bar fills. Each payment the committee confirms goes on a ledger every resident can read, with the payer’s name and flat.',
  },
  {
    icon: Receipt,
    title: 'Every rupee, with the bill',
    body: 'Staff upload each bill, the committee approves it, and residents see the vendor, amount and invoice.',
  },
  {
    icon: Vote,
    title: 'Residents suggest and vote',
    body: 'Suggest an activity or idea; once the committee approves it, everyone votes.',
  },
  {
    icon: MessageCircle,
    title: 'Campaigns from residents',
    body: 'Anyone can propose a fundraising campaign. The committee approves it before collection starts.',
  },
];

/**
 * Both doors, named on the front page. Signing in is the step before either,
 * not a third choice: the intent rides through login in `next`, so someone who
 * clicked "Start a society" lands on the create form rather than back here.
 */
const withIntent = (mode: 'join' | 'create') =>
  `/login?next=${encodeURIComponent(`/onboarding?mode=${mode}`)}`;

/** Lamplight in the corner the kolam turns in, and a little of the ribbon opposite. */
const GLOW: CSSProperties = {
  backgroundImage: [
    'radial-gradient(ellipse 55% 60% at 92% 10%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 70%)',
    'radial-gradient(ellipse 45% 55% at 0% 100%, color-mix(in oklch, var(--ribbon) 14%, transparent), transparent 70%)',
  ].join(', '),
};

/**
 * The grid of dots a kolam is drawn around, fading out before it reaches the
 * words so it never sits under anything that has to be read. Wide screens
 * only: on anything narrower the words are the whole width.
 */
const KOLAM_DOTS: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent) 1.1px, transparent 1.7px)',
  backgroundSize: '24px 24px',
  maskImage: 'linear-gradient(to left, black 0%, transparent 55%)',
};

export default async function LandingPage(props: PageProps<'/'>) {
  // Signed-in visitors have no use for the pitch.
  const user = await getCurrentUser();
  if (user) redirect('/app');

  // Somebody who has just deleted their account arrives here, signed out, with
  // no other way of knowing it worked. The pitch is the wrong thing to greet
  // them with on its own.
  const { deleted } = await props.searchParams;

  // The page wears the colours of whichever festival is next, the way every
  // event in the app wears its own. See lib/season.ts.
  const { next, palette, upcoming } = season(todayIn(), 6);

  return (
    <div style={festivalVars(palette)} className="min-h-dvh">
      <div className="bg-[var(--festival-wash)]">
        <Garland id="garland-top" />
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-3 pb-1">
          <span className="inline-flex items-center gap-2">
            <span className="from-accent to-ribbon text-accent-ink grid size-8 place-items-center rounded-lg bg-linear-to-br text-sm font-bold shadow-sm">
              स
            </span>
            <span className="text-lg font-semibold tracking-tight">Samudaya</span>
          </span>
          <ButtonLink href="/login" variant="secondary" size="sm">
            Sign in
          </ButtonLink>
        </header>
      </div>

      <main id="main">
        <section className="relative isolate overflow-hidden bg-[var(--festival-wash)]">
          <div aria-hidden="true" className="absolute inset-0 -z-10" style={GLOW} />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 hidden lg:block"
            style={KOLAM_DOTS}
          />
          {/* On a phone or a tablet the words are the whole width, so the kolam
              only peeks in at the corner. From lg there is a column beside the
              text, and it is placed from the centre so it starts where the
              headline's 42rem ends at every width. */}
          <Rangoli
            petals={palette.petals}
            strokeWidth={0.6}
            className="motion-safe:animate-rangoli pointer-events-none absolute -top-36 -right-36 -z-10 size-72 opacity-30 lg:top-[-4.5rem] lg:right-auto lg:left-[calc(50%+12rem)] lg:size-[36rem] lg:opacity-40"
          />
          <Rangoli
            petals={palette.petals}
            strokeWidth={0.9}
            className="pointer-events-none absolute -bottom-28 -left-28 -z-10 hidden size-64 opacity-25 sm:block"
          />
          <Sparkles className="-z-10" />

          <div className="mx-auto max-w-5xl px-6 pt-8 pb-28 sm:pt-12 sm:pb-36">
            {deleted ? (
              <p
                role="status"
                className="border-border-base bg-surface-raised text-ink mb-8 rounded-xl border px-5 py-4 text-sm"
              >
                Your account has been deleted. Contributions and bills stay in your society&rsquo;s
                ledger with your name removed, as our{' '}
                <Link href="/privacy" className="text-accent underline underline-offset-4">
                  Privacy Policy
                </Link>{' '}
                describes.
              </p>
            ) : null}

            {next ? (
              <p className="border-accent/25 bg-surface-raised/80 text-ink inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border px-3.5 py-1.5 text-sm shadow-sm backdrop-blur-sm">
                <span aria-hidden="true">{next.emoji}</span>
                <span className="font-medium">Getting ready for {next.name},</span>
                <span className="text-ink-muted">{next.when}</span>
              </p>
            ) : null}
            <p className="text-accent mt-6 text-sm font-medium">समुदाय · community</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Plan together. Participate together.{' '}
              <span className="from-accent to-ribbon bg-linear-to-r bg-clip-text text-transparent">
                Spend transparently.
              </span>
            </h1>
            <p className="text-ink-muted mt-5 max-w-xl text-lg text-pretty">
              Samudaya gives every community event its own activities, budget, fund and public
              ledger — so residents can see exactly what is planned, what was spent, and on what. On
              the web and on your phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href={withIntent('join')}
                size="lg"
                className="shadow-accent/30 shadow-md"
              >
                Join your society
              </ButtonLink>
              <ButtonLink href={withIntent('create')} variant="secondary" size="lg">
                Start a society
              </ButtonLink>
            </div>
            <p className="text-ink-muted mt-4 max-w-md text-sm">
              Residents join with the code their committee shares, and staff approve each one.
              Setting your society up for the first time? You don’t need a code.
            </p>
          </div>
        </section>

        <section className="relative mx-auto -mt-20 max-w-5xl px-6 pb-20 sm:-mt-24">
          <div className="from-accent via-ribbon to-accent shadow-accent/20 rounded-[1.15rem] bg-linear-to-br p-[3px] shadow-xl">
            <figure className="bg-surface-raised overflow-hidden rounded-2xl">
              <DemoVideo />
              <figcaption className="text-ink-muted border-border-base border-t px-5 py-3 text-sm">
                Under two minutes, with a voice-over — turn the sound on — and every point is on
                screen as well, so it works without. The screens are drawn from the app&rsquo;s own;
                the society, the neighbours and the amounts are invented.
              </figcaption>
            </figure>
          </div>
        </section>

        <section aria-labelledby="festivals" className="mx-auto max-w-5xl px-6 pb-20">
          <h2 id="festivals" className="text-2xl font-semibold tracking-tight text-balance">
            Every festival, in its own colours
          </h2>
          <p className="text-ink-muted mt-3 max-w-2xl text-pretty">
            Start an event and Samudaya suggests the festivals coming up. Pick one and it fills in
            the name and a date, and the event takes that festival&rsquo;s colours
            {next ? <> — this page is wearing {next.name}&rsquo;s</> : null}. A festival that
            follows the moon comes with a reminder to check the date before you publish.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {upcoming.map((entry) => (
              <li
                key={entry.id}
                style={festivalVars(entry.palette)}
                className="border-border-base relative isolate overflow-hidden rounded-xl border bg-[var(--festival-wash)] p-4"
              >
                <div
                  aria-hidden="true"
                  className="from-accent to-ribbon absolute inset-x-0 top-0 h-1 bg-linear-to-r"
                />
                <Rangoli
                  petals={entry.palette.petals}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute -top-8 -right-8 -z-10 size-24 opacity-30"
                />
                <span
                  aria-hidden="true"
                  className="from-accent to-ribbon block size-11 rounded-full bg-linear-to-br p-[2px] shadow-sm"
                >
                  <span className="bg-surface-raised grid size-full place-items-center rounded-full text-xl">
                    {entry.emoji}
                  </span>
                </span>
                <p className="text-ink mt-3 font-semibold">{entry.name}</p>
                <p className="text-ink-muted mt-0.5 text-sm">{entry.when}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border-base bg-surface-sunken border-t">
          <div className="bg-border-base mx-auto grid max-w-5xl gap-px sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-surface-sunken p-6">
                <span className="from-accent to-ribbon text-accent-ink grid size-9 place-items-center rounded-lg bg-linear-to-br shadow-sm">
                  <Icon className="size-[1.1rem]" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-sm font-semibold tracking-tight">{title}</h2>
                <p className="text-ink-muted mt-1.5 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[var(--festival-wash)]">
        <Garland id="garland-foot" />
        <div className="text-ink-muted mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 pt-6 pb-10 text-sm">
          <span>Samudaya</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline underline-offset-4">
              Terms &amp; Conditions
            </Link>
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
