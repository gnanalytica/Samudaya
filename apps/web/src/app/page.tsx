import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ClipboardList, MessageCircle, Receipt, Vote, Wallet } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';

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
    icon: Wallet,
    title: 'A fund with a target',
    body: 'Residents chip in, the bar fills, and totals are public while individual amounts stay private.',
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
            Plan together. Participate together. Spend transparently.
          </h1>
          <p className="text-ink-muted mt-5 max-w-xl text-lg text-pretty">
            Samudaya gives every community event its own activities, budget, fund and public ledger
            — so residents can see exactly what is planned, what was spent, and on what. On the web
            and on your phone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="lg">
              Get started
            </ButtonLink>
          </div>
          <p className="text-ink-subtle mt-4 text-sm">
            Residents join with their society’s code, and staff approve each one.
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
