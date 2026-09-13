import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowLeft } from 'lucide-react';
import { joinLink } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { CopyButton, InviteMessage, JoinQr } from './invite-tools';

export const metadata = { title: 'Invite' };

/** The site's own origin, for links that leave the app (WhatsApp, printed QR codes). */
async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function InvitePage(props: PageProps<'/app/[community]/admin/invite'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'joinrequests:review');
  const link = joinLink(await siteUrl(), community.join_code);
  const base = `/app/${community.slug}`;

  return (
    <>
      <PageHeader
        title="Invite"
        description="One society code for everyone. The join link fills it in, and staff or the committee approve each person."
      />
      <PageBody>
        <div className="mx-auto max-w-3xl space-y-5">
          <Link
            href={`${base}/admin`}
            className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Console
          </Link>

          <Card>
            <CardHeader title="Society code and join link" />
            <CardBody className="grid gap-6 sm:grid-cols-[1fr_auto]">
              <div className="space-y-4">
                <div>
                  <p className="text-ink-subtle text-xs tracking-wide uppercase">Society code</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-ink font-mono text-2xl font-semibold tracking-widest">
                      {community.join_code}
                    </span>
                    <CopyButton value={community.join_code} label="Copy code" />
                  </div>
                </div>
                <div>
                  <p className="text-ink-subtle text-xs tracking-wide uppercase">Join link</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-ink font-mono text-sm break-all">{link}</span>
                    <CopyButton value={link} label="Copy link" />
                  </div>
                </div>
              </div>
              <JoinQr link={link} societyName={community.name} />
            </CardBody>
          </Card>

          <Card id="staff">
            <CardHeader
              title="Bring in staff"
              description="Your supervisor or estate manager joins the same way as residents."
            />
            <CardBody className="space-y-3 text-sm">
              <ol className="text-ink list-decimal space-y-1.5 pl-5">
                <li>Send them the join link above (or the society code).</li>
                <li>
                  They sign in with Google and choose <strong>I work for the society</strong>, so
                  they don’t need a flat.
                </li>
                <li>
                  A committee member opens Join requests, sets the role to <strong>Staff</strong>{' '}
                  and approves.
                </li>
              </ol>
              <ButtonLink href={`${base}/admin/requests`} size="sm" variant="secondary">
                Open join requests
              </ButtonLink>
            </CardBody>
          </Card>

          <Card id="residents">
            <CardHeader
              title="Invite residents"
              description="Post this in your society’s WhatsApp group, or print the QR code on the notice board."
            />
            <CardBody>
              <InviteMessage societyName={community.name} code={community.join_code} link={link} />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
