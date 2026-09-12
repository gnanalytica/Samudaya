'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createWhatsAppLinkCode, unlinkWhatsApp, type LinkCodeState } from './actions';

const initial: LinkCodeState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? 'Working…' : label}
    </Button>
  );
}

export function WhatsAppCard({
  slug,
  linkedPhone,
  botNumber,
}: {
  slug: string;
  linkedPhone: string | null;
  botNumber: string | null;
}) {
  const [state, action] = useActionState(createWhatsAppLinkCode, initial);

  return (
    <Card>
      <CardHeader
        title="WhatsApp"
        description="Report issues, check dues and create gate passes without opening the app."
        action={
          linkedPhone ? (
            <Badge tone="success">Linked</Badge>
          ) : (
            <Badge tone="neutral">Not linked</Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {linkedPhone ? (
          <>
            <p className="text-ink text-sm">
              Linked to <span className="font-medium">{linkedPhone}</span>. Send{' '}
              <span className="font-mono">help</span> to the bot to see what it can do.
            </p>
            <form action={unlinkWhatsApp}>
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" variant="ghost" size="sm">
                Unlink this number
              </Button>
            </form>
          </>
        ) : state.code ? (
          <div className="space-y-3">
            <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 rounded-xl border p-4">
              <p className="text-ink-muted text-xs tracking-wide uppercase">Send this to the bot</p>
              <p className="text-ink mt-1.5 font-mono text-xl font-semibold tracking-wider">
                link {state.code}
              </p>
              <p className="text-ink-muted mt-2 text-xs">
                From the number you want to link
                {botNumber ? (
                  <>
                    , to <span className="text-ink font-medium">{botNumber}</span>
                  </>
                ) : null}
                . Good for 15 minutes.
              </p>
            </div>
            <form action={action}>
              <input type="hidden" name="slug" value={slug} />
              <Submit label="Get a new code" />
            </form>
          </div>
        ) : (
          <>
            <ol className="text-ink-muted space-y-1.5 text-sm">
              <li>1. Get a link code below.</li>
              <li>
                2. WhatsApp <span className="text-ink font-mono">link &lt;code&gt;</span> to the
                community bot{botNumber ? ` on ${botNumber}` : ''}.
              </li>
              <li>3. That’s it — send *help* to see the commands.</li>
            </ol>
            {state.error ? (
              <p role="alert" className="text-danger text-sm">
                {state.error}
              </p>
            ) : null}
            <form action={action}>
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" size="sm">
                <MessageCircle className="size-4" aria-hidden="true" />
                Get a link code
              </Button>
            </form>
          </>
        )}
      </CardBody>
    </Card>
  );
}
