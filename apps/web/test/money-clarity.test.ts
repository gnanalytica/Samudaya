import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What the committee asked for after reading an event's Fund card: numbers
 * that add up and belong to this event only, spending you can see at a
 * glance, a balance staff never have to go looking for, and no money moving
 * — in or out — without something to show for it.
 */
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const APP = ['app', 'app', '[community]'];

describe('the Fund card', () => {
  const event = read(...APP, 'events', '[event]', 'page.tsx');
  const tiles = read('components', 'event-balance.tsx');

  it('draws spending as a second bar, in a colour of its own', () => {
    expect(event).toContain('<SpendBar');
    expect(read('components', 'badges.tsx')).toMatch(/over \? 'bg-danger' : 'bg-warning'/);
  });

  it('shows tiles that add up: collected, less spent, is the balance', () => {
    expect(event).toContain('<EventMoneyTiles');
    expect(event).not.toContain('label="From residents"');
    for (const label of ['label="Collected"', 'label="Spent"', 'label="Balance"']) {
      expect(tiles).toContain(label);
    }
    // Money carried in is this event's once it arrives, and the tile says so.
    expect(tiles).toContain('carried in');
  });
});

describe('the balance, for staff and the committee', () => {
  it('leads the event page and the Manage overview', () => {
    expect(read(...APP, 'events', '[event]', 'page.tsx')).toMatch(
      /isStaff[^\n]*\n\s*<EventBalanceCard/,
    );
    expect(read(...APP, 'admin', 'events', '[event]', 'page.tsx')).toContain('<EventBalanceCard');
  });
});

describe('nothing moves without something to show for it', () => {
  const forms = read(...APP, 'admin', 'events', '[event]', 'forms.tsx');
  const actions = read(...APP, 'admin', 'events', 'actions.ts');

  it('a bill needs its vendor and a photo, in view rather than under More details', () => {
    expect(forms).toMatch(/name="vendor"[\s\S]{0,300}required/);
    expect(forms).toContain('label="Photo of the bill (required)"');
    expect(forms).toContain('Paid by, method, date');
  });

  it('a payment staff record needs a reference or a screenshot unless it is cash', () => {
    expect(forms).toContain('name="proof_path"');
    expect(actions).toContain('recordedPaymentEvidenceProblem(');
  });

  it('spending from the society balance needs a reason, a payee and a receipt', () => {
    const money = read(...APP, 'money', 'page.tsx');
    expect(money).toContain('<SocietyExpenseForm');
    const moneyActions = read(...APP, 'money', 'actions.ts');
    expect(moneyActions).toContain("rpc('record_society_expense'");
    expect(moneyActions).toContain("rpc('cover_overspend'");
  });

  it('an overspent event waits in To do with a way to pay the person back', () => {
    const todo = read(...APP, 'todo', 'page.tsx');
    expect(todo).toContain("case 'overspent':");
    expect(todo).toContain('<CoverOverspendForm');
  });
});

describe('the phone', () => {
  const MOBILE = join(import.meta.dirname, '..', '..', 'mobile');
  const phone = (...parts: string[]) => readFileSync(join(MOBILE, ...parts), 'utf8');

  it('shows the same spent bar and adding-up tiles, and the balance for staff', () => {
    const event = phone('app', 'event', '[slug].tsx');
    expect(event).toContain('<EventMoneyTiles');
    expect(event).toContain("tone={money.overBy > 0 ? 'danger' : 'warning'}");
    expect(event).toContain('<EventBalanceCard');
    expect(phone('app', 'admin', 'event', '[slug].tsx')).toContain('<EventBalanceCard');
  });

  it('holds bills and payments to the same rules', () => {
    expect(phone('app', 'admin', 'bill.tsx')).toContain('Pick the vendor this bill is from.');
    expect(phone('app', 'admin', 'payments.tsx')).toContain('recordedPaymentEvidenceProblem(');
  });

  it('lets staff spend the society balance and the committee pay people back', () => {
    expect(phone('app', 'admin', 'society-spend.tsx')).toContain("rpc('record_society_expense'");
    expect(phone('app', 'admin', 'pay-back.tsx')).toContain("rpc('cover_overspend'");
    expect(phone('src', 'components', 'todo-queue.tsx')).toContain("pathname: '/admin/pay-back'");
  });
});
