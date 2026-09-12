import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, CalendarCheck, MessageCircle, Receipt, ShieldCheck, Wrench } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';

const FEATURES = [
  {
    icon: Bell,
    title: 'Notices that land',
    body: 'Post once — it reaches the app, the phone and WhatsApp. No more paper on the lift door.',
  },
  {
    icon: Wrench,
    title: 'Requests that get closed',
    body: 'Residents raise an issue, staff work it, everyone sees the status. Nothing gets lost in a group chat.',
  },
  {
    icon: ShieldCheck,
    title: 'A gate that knows who’s coming',
    body: 'Pre-approve a guest and they arrive with a code. Security sees the list, logs arrivals and departures.',
  },
  {
    icon: CalendarCheck,
    title: 'Amenities without arguments',
    body: 'The clubhouse can only be booked once for a slot — the database refuses a double booking.',
  },
  {
    icon: Receipt,
    title: 'Dues in the open',
    body: 'Invoices per flat, payments recorded, balances that add up.',
  },
  {
    icon: MessageCircle,
    title: 'Works over WhatsApp',
    body: 'Residents who will never install an app can still report a leak and check their dues.',
  },
];

export default async function LandingPage() {
  // Signed-in visitors have no use for the pitch.
  const user = await getCurrentUser();
  if (user) redirect('/app');

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="inline-flex items-center gap-2">
          <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg text-sm font-bold">
            स
          </span>
          <span className="text-lg font-semibold tracking-tight">Samudaya</span>
        </span>
        <ButtonLink href="/login" variant="secondary" size="sm">
          Sign in
        </ButtonLink>
      </header>

      <main id="main">
        <section className="mx-auto max-w-5xl px-6 pt-12 pb-16 sm:pt-20">
          <p className="text-accent text-sm font-medium">समुदाय · community</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Everything your residential community runs on, in one place.
          </h1>
          <p className="text-ink-muted mt-5 max-w-xl text-lg text-pretty">
            Notices, complaints, visitors, amenities and maintenance dues — for the committee, the
            gate and every resident. On the web, on iOS and Android, and over WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="lg">
              Get started
            </ButtonLink>
            <ButtonLink href="/onboarding?mode=create" variant="secondary" size="lg">
              Set up a society
            </ButtonLink>
          </div>
          <p className="text-ink-subtle mt-4 text-sm">
            Residents join with a code from their admin — nobody gets in by guessing a URL.
          </p>
        </section>

        <section className="border-border-base bg-surface-sunken border-t">
          <div className="bg-border-base mx-auto grid max-w-5xl gap-px px-6 py-px sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-surface-sunken p-6">
                <Icon className="text-accent size-5" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-semibold tracking-tight">{title}</h2>
                <p className="text-ink-muted mt-1.5 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="text-ink-subtle mx-auto max-w-5xl px-6 py-10 text-sm">
        <div className="border-border-base flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <span>Samudaya</span>
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
