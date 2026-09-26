import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every payment can say which flat it came from.
 *
 * The Money page has shown the flat beside the payer's name since the ledger
 * was widened, and some rows still read as a bare name — which looks exactly
 * like the app having dropped the field. It had not. Those payments were made
 * by members nobody had listed at a door: `contributions.unit_id` was null,
 * the occupancy fallback had nothing to borrow, and the UPI note went out
 * without the flat the bank matcher reads.
 *
 * Nothing downstream can recover that. The only moment anybody knows is while
 * the resident is on the Contribute screen, so that is where it is asked — on
 * both apps, before they pay, so the note carries it too.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const web = (...parts: string[]) => readFileSync(join(ROOT, 'web', 'src', ...parts), 'utf8');
const mobile = (...parts: string[]) => readFileSync(join(ROOT, 'mobile', ...parts), 'utf8');

const actions = () => web('app', 'app', '[community]', 'events', 'actions.ts');

describe('asking for the flat when the society has none', () => {
  it('only asks the members nobody has listed at a door', () => {
    // A society that knows already must not be made to answer again, and what
    // such a form posts must not be able to move the payment somewhere else.
    const action = actions().slice(actions().indexOf('export async function contribute'));
    const body = action.slice(0, 4000);
    expect(body).toContain('let unitId = context.unitIds[0] ?? null;');
    expect(body).toContain('if (!unitId) {');
    expect(body).toContain('unit_id: unitId,');
  });

  it('checks the flat is one of this society’s before it goes on the payment', () => {
    // A form posts what the browser hands it. The insert policy refuses
    // another society's door too; this is so the resident gets a sentence
    // rather than a database error.
    const body = actions().slice(actions().indexOf('export async function contribute'), 8000);
    expect(body).toContain("eq('community_id', context.community.id)");
    expect(body).toContain("fieldErrors: { unit_id: 'Pick a flat from the list.' }");
  });

  it('and tells the committee, who are the ones who decide where people live', () => {
    const body = actions().slice(actions().indexOf('export async function contribute'), 8000);
    expect(body).toContain("supabase.rpc('request_unit_change'");
  });

  it('settles it before the note is copied, not after the money has gone', () => {
    // It first went in beside the rest of step 3 — which is the screen you
    // reach after paying. The note in step 2 carries the flat into the UPI
    // app, so by then it is already too late: the payment lands on the
    // statement as one more line nobody can place.
    const form = web(
      'app',
      'app',
      '[community]',
      'events',
      '[event]',
      'contribute',
      'contribute-form.tsx',
    );
    const body = form.slice(form.indexOf('<CardBody className="space-y-6">'));
    expect(body.indexOf('Which flat is this payment for?')).toBeLessThan(body.indexOf('1. Amount'));
    // And nothing that carries the note is offered until it is answered.
    expect(form).toContain('const ready = Boolean(amount) && (!flatNeeded || Boolean(flatId));');
    expect(form).toContain('<Submit disabled={uploading || (flatNeeded && !flatId)} />');
    expect(form).toContain('Pick your flat above and the note will say which one paid.');
  });

  it('puts the answer in the UPI note, so the bank line names the flat too', () => {
    // Half the value of knowing the flat is on the statement, not the screen.
    const form = web(
      'app',
      'app',
      '[community]',
      'events',
      '[event]',
      'contribute',
      'contribute-form.tsx',
    );
    expect(form).toContain('upiNote(flatLabel ?? (chosen ? unitLabel(chosen) : null), eventName)');
    // The phone settles it before paying, because the note is carried into
    // another app and there is no second chance to change it.
    const phone = mobile('app', 'contribute.tsx');
    expect(phone).toContain('const payingFor = unit ?? chosenFlat;');
    expect(phone).toContain('upiNote(payingFor ? unitLabel(payingFor) : null, event.name)');
    expect(phone).toContain('disabled={!amount || (flatNeeded && !chosenFlat)}');
  });

  it('records the flat the payer chose, on both apps', () => {
    expect(mobile('app', 'contribute.tsx')).toContain('unit_id: payingFor?.id ?? null,');
  });
});

describe('a ledger row that still has no flat', () => {
  it('says so rather than leaving a gap that reads like a bug', () => {
    // Both surfaces ask the same function, so neither can decide on its own
    // that a missing flat is worth mentioning and the other stay quiet.
    expect(web('components', 'ledger-row.tsx')).toContain('const flat = ledgerFlat(row);');
    expect(mobile('app', '(tabs)', 'money.tsx')).toContain('const flat = ledgerFlat(item);');
  });

  it('draws it as the gap it is, not as a flat called “not recorded”', () => {
    expect(web('components', 'ledger-row.tsx')).toContain('flat.known');
    expect(mobile('app', '(tabs)', 'money.tsx')).toContain('flat.known');
  });
});
