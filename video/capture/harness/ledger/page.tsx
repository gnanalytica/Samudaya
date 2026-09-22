/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/capture.mjs and deleted again when the capture finishes, so
// nothing here is ever built, linted or shipped.
import { PiggyBank } from 'lucide-react';
import { formatDate, formatMoney, fundMovementLine } from '@samudaya/core';
import { StatTile, StatTiles } from '@/components/badges';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { LedgerRow, type LedgerRowData } from '@/components/ledger-row';

const CURRENCY = 'INR';

const rows: LedgerRowData[] = [
  {
    id: '1',
    direction: 'in',
    counterpart: 'Asha Menon',
    detail: 'A 402 · Upi',
    payer_name: 'Asha Menon',
    unit_label: 'A 402',
    method: 'Upi',
    amount: 2001,
    happened_at: '2026-09-14T09:12:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-14T18:00:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '2',
    direction: 'out',
    counterpart: 'Paper Glow Decorators',
    detail: 'Decoration',
    payer_name: null,
    unit_label: null,
    method: null,
    amount: -8400,
    happened_at: '2026-09-13T11:00:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-13T15:30:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '3',
    direction: 'in',
    counterpart: 'Dev Sharma',
    detail: 'B 1104 · Upi',
    payer_name: 'Dev Sharma',
    unit_label: 'B 1104',
    method: 'Upi',
    amount: 1001,
    happened_at: '2026-09-13T08:40:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-13T19:05:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '4',
    direction: 'in',
    counterpart: 'A 703',
    detail: 'Cash',
    payer_name: null,
    unit_label: 'A 703',
    method: 'Cash',
    amount: 500,
    happened_at: '2026-09-12T17:20:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-12T20:00:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '5',
    direction: 'out',
    counterpart: 'Sri Ganesh Sound Service',
    detail: 'Sound and lights',
    payer_name: null,
    unit_label: null,
    method: null,
    amount: -6500,
    happened_at: '2026-09-11T14:00:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-11T16:10:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '6',
    direction: 'in',
    counterpart: 'Esha Patil',
    detail: 'B 306 · Upi',
    payer_name: 'Esha Patil',
    unit_label: 'B 306',
    method: 'Upi',
    amount: 3001,
    happened_at: '2026-09-11T07:55:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-11T18:30:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
];

const movements = [
  {
    id: 'm1',
    kind: 'society_balance' as const,
    amount: 4200,
    from_event: { name: 'Independence Day 2026' },
    to_event: null,
    decided_at: '2026-08-20T10:00:00Z',
    note: 'Nothing else running at the time.',
    decider: { profiles: { full_name: 'Bala Krishnan' } },
  },
  {
    id: 'm2',
    kind: 'next_event' as const,
    amount: 7800,
    from_event: { name: 'Summer Camp 2026' },
    to_event: { name: 'Ganesh Chaturthi 2026' },
    decided_at: '2026-07-02T10:00:00Z',
    note: null,
    decider: { profiles: { full_name: 'Chitra Rao' } },
  },
];

export default function Harness() {
  return (
    <div className="bg-surface min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-ink text-3xl font-semibold tracking-tight">Money</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Every rupee Shanti Nivas has taken in and spent, since the day it started.
        </p>

        <div className="mt-6">
          <StatTiles>
            <StatTile label="Collected" value={formatMoney(46500, CURRENCY)} />
            <StatTile label="Spent" value={formatMoney(31200, CURRENCY)} />
            <StatTile label="Balance" value={formatMoney(15300, CURRENCY)} tone="success" />
          </StatTiles>
        </div>

        <Card className="mt-5">
          <CardHeader
            title="Where money has moved"
            description="What was left over when an event closed, and what the committee decided to do with it — carry it to another event, or keep it for the society."
          />
          <CardBody className="border-border-base flex items-center gap-3 border-b">
            <PiggyBank className="text-accent size-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-ink text-lg font-semibold">{formatMoney(4200, CURRENCY)}</p>
              <p className="text-ink-subtle text-xs">
                Society balance · what is left after all of this, behind no event
              </p>
            </div>
          </CardBody>
          <ul className="divide-border-base divide-y">
            {movements.map((movement) => (
              <li key={movement.id} className="px-5 py-3">
                <p className="text-ink text-sm">{fundMovementLine(movement as never, CURRENCY)}</p>
                <p className="text-ink-subtle mt-0.5 text-xs">
                  {formatDate(movement.decided_at.slice(0, 10))}
                  {` · decided by ${movement.decider.profiles.full_name}`}
                  {movement.note ? ` · ${movement.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-5">
          <CardHeader
            title="Every transaction"
            description="Confirmed payments in and approved bills out. A payment waiting to be confirmed is not here yet."
          />
          <ul className="divide-border-base divide-y">
            {rows.map((row) => (
              <LedgerRow key={row.id} row={row} slug="shanti-nivas" currency={CURRENCY} />
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
