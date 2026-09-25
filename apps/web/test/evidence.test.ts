import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The picture behind a number stays reachable, and is sized like the thing
 * somebody came to the page to do.
 *
 * A screenshot is what a committee member checks a payment against, and the
 * bank statement arrives weeks after the confirming tap. Both surfaces used to
 * show it only while a payment was still waiting — the one moment nobody needs
 * it, because the resident's word is all anybody has at that point anyway. Once
 * confirmed, the evidence vanished from the page that exists to be reconciled.
 *
 * The other half is size. Both viewers were a chip the size of a filter sitting
 * in a row of filters, which is not what the most important control on the card
 * should look like. "Big" is pinned here as a tap target rather than a font
 * size, because that is the part a restyle must not quietly take back.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const WEB_ADMIN_EVENT = ['web', 'src', 'app', 'app', '[community]', 'admin', 'events', '[event]'];
const CONTRIBUTE = [
  'web',
  'src',
  'app',
  'app',
  '[community]',
  'events',
  '[event]',
  'contribute',
  'contribute-form.tsx',
];

describe('payment screenshots', () => {
  it('open from the confirmed list too, on web', () => {
    const page = read(...WEB_ADMIN_EVENT, 'page.tsx');
    // Once for the payments waiting to be confirmed, once for the table of
    // every payment for the event.
    expect(count(page, '<StoredFileLink')).toBe(2);
    expect(page).toContain('Screenshot');
  });

  it('open from the confirmed list too, on mobile', () => {
    const screen = read('mobile', 'app', 'admin', 'payments.tsx');
    expect(count(screen, '<ViewFileButton')).toBe(2);
  });
});

describe('the viewer is a button', () => {
  it('keeps a 44px tap target on web', () => {
    const link = read('web', 'src', 'components', 'bill-link.tsx');
    // Both the card-sized and the in-table variant.
    expect(count(link, 'pointer-coarse:min-h-11')).toBe(2);
  });

  it('uses the 48px shared Button on mobile', () => {
    const fileUi = read('mobile', 'src', 'components', 'file-ui.tsx');
    const viewer = fileUi.slice(fileUi.indexOf('export function ViewFileButton'));
    expect(viewer).toContain('<Button');
    expect(viewer).not.toContain('<Chip');
    expect(read('mobile', 'src', 'components', 'ui.tsx')).toContain('minHeight: 48');
  });
});

describe('contributing', () => {
  /**
   * The QR code was the first thing on the pay step and the least useful: most
   * residents read this on the phone they are about to pay from, where there is
   * nothing to scan it with, and it pushed the two things they do carry into
   * their UPI app — the ID and the note — into small print underneath.
   */
  it('does not draw a QR code', () => {
    const form = read(...CONTRIBUTE);
    expect(form).not.toContain("from 'qrcode'");
    expect(form).not.toContain('QRCode.toDataURL');
  });

  it('offers the UPI ID and the note to copy instead', () => {
    const form = read(...CONTRIBUTE);
    expect(count(form, '<CopyButton')).toBe(2);
    expect(form).toContain('value={upi.vpa}');
    expect(form).toContain('value={note}');
  });

  it('still opens the UPI app with the amount filled in', () => {
    expect(read(...CONTRIBUTE)).toContain('Open UPI app');
  });
});

/**
 * What the society kept, on both home screens and on both money screens.
 *
 * An event that closed with money left used to report a surplus forever while
 * the next event opened at zero and asked sixty flats for money the society
 * was already holding. The number now has somewhere to live, and the rule is
 * that it lives in the same places on both apps: a figure a resident can see
 * on the phone and not on the web is a figure two neighbours will disagree
 * about.
 *
 * It was called the "society balance", beside a Balance tile that meant all
 * the money the society holds; a committee member read "Balance ₹7,820" over
 * "Society balance ₹0" as a contradiction. It is "kept for the society" now,
 * which is also what the committee chose at closure to put it there.
 */
describe('what the society kept', () => {
  it('is on the home screen of both apps, not just the one', () => {
    expect(read('web', 'src', 'app', 'app', '[community]', 'page.tsx')).toContain(
      'Kept for the society',
    );
    expect(read('mobile', 'app', '(tabs)', 'index.tsx')).toContain('Kept for the society');
  });

  it('is never called a balance beside the Balance tile', () => {
    for (const parts of [
      ['web', 'src', 'app', 'app', '[community]', 'page.tsx'],
      ['web', 'src', 'app', 'app', '[community]', 'money', 'page.tsx'],
      ['mobile', 'app', '(tabs)', 'index.tsx'],
      ['mobile', 'app', 'money.tsx'],
    ]) {
      // Comments may still tell the story; the words on screen may not.
      const code = read(...parts).replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//g, '');
      expect(code, parts.join('/')).not.toMatch(/Society balance/);
    }
  });

  it('is shown on both money screens as part of where the balance is', () => {
    for (const parts of [
      ['web', 'src', 'app', 'app', '[community]', 'money', 'page.tsx'],
      ['mobile', 'app', 'money.tsx'],
    ]) {
      const screen = read(...parts);
      expect(screen, parts.join('/')).toContain('whereTheBalanceIs');
      expect(screen, parts.join('/')).toContain('Kept for the society');
    }
  });

  it('opens the log of where every rupee of it came from', () => {
    const web = read('web', 'src', 'app', 'app', '[community]', 'money', 'page.tsx');
    expect(web).toContain('fundMovementLine');
    expect(web).toContain('id="society-balance"');
    // The home card links straight to that anchor.
    expect(read('web', 'src', 'app', 'app', '[community]', 'page.tsx')).toContain(
      'money#society-balance',
    );
    expect(read('mobile', 'app', 'money.tsx')).toContain('fundMovementLine');
  });

  it('is decided at closure by the committee, on both apps', () => {
    expect(
      read('web', 'src', 'app', 'app', '[community]', 'admin', 'events', '[event]', 'page.tsx'),
    ).toContain('AllocateSurplusForm');
    expect(read('mobile', 'app', 'admin', 'event', '[slug].tsx')).toContain('allocate_surplus');
  });

  it('can be spent again, so keeping a surplus is not a one-way door', () => {
    expect(
      read('web', 'src', 'app', 'app', '[community]', 'admin', 'events', '[event]', 'page.tsx'),
    ).toContain('SpendBalanceForm');
    expect(read('mobile', 'app', 'admin', 'event', '[slug].tsx')).toContain(
      'spend_society_balance',
    );
  });
});

describe('money moved behind an event', () => {
  /**
   * Only a committee member can move the society's money, and the database
   * records who (fund_movements.decided_by). The Money page's history always
   * named them; the event the money landed in said only "the committee", so a
   * resident asked for ₹1,93,010 instead of ₹2,00,000 could not see on the
   * event whose decision that was. Every screen that says money was carried
   * in now says who carried it, and when.
   */
  it('names who moved it, on every screen that says it was moved', () => {
    const component = read('web', 'src', 'components', 'carried-in.tsx');
    expect(component).toContain('carriedFromLine');
    for (const parts of [
      ['web', 'src', 'app', 'app', '[community]', 'events', '[event]', 'page.tsx'],
      ['web', 'src', 'app', 'app', '[community]', 'events', '[event]', 'contribute', 'page.tsx'],
      ['web', 'src', 'app', 'app', '[community]', 'admin', 'events', '[event]', 'page.tsx'],
    ]) {
      const screen = read(...parts);
      expect(screen, parts.join('/')).toContain('<CarriedIn');
      expect(screen, parts.join('/')).toContain('getCarriedInto');
      // The bare sentence, without the name, would be the old gap back.
      expect(screen, parts.join('/')).not.toContain('carriedInLine(');
    }
    expect(read('mobile', 'app', 'event', '[slug].tsx')).toContain('carriedFromLine');
  });

  it('names them on the home card of both apps too', () => {
    expect(read('web', 'src', 'app', 'app', '[community]', 'page.tsx')).toContain(
      'carriedDeciders',
    );
    expect(read('mobile', 'app', '(tabs)', 'index.tsx')).toContain('carriedDeciders');
  });

  it('says on every compact fund card what is already in the fund and what is waiting', () => {
    // Velocity vipers read "₹0 of ₹1,93,010 raised · After ₹6,990 carried
    // across by the committee" while ₹6,990 sat in its fund and two households
    // had reported ₹20,500 more. The ₹0 was true — confirmed money only — and
    // the card said nothing about either sum being there.
    for (const parts of [
      ['web', 'src', 'app', 'app', '[community]', 'page.tsx'],
      ['web', 'src', 'app', 'app', '[community]', 'events', 'page.tsx'],
      ['mobile', 'app', '(tabs)', 'index.tsx'],
      ['mobile', 'app', '(tabs)', 'events.tsx'],
    ]) {
      const screen = read(...parts);
      expect(screen, parts.join('/')).toContain('awaitingLine(');
      expect(screen, parts.join('/')).toContain('alreadyInFundLine(');
      expect(screen, parts.join('/')).not.toContain('After {formatMoney');
    }
    // The web home card draws its own bar on the festival colour; it has to
    // draw the paler waiting segment the shared FundBar draws everywhere else.
    expect(read('web', 'src', 'app', 'app', '[community]', 'page.tsx')).toContain('bar.pending');
  });
});

describe('the fund bar', () => {
  /**
   * Nine screens draw this bar between them. A bar measured against the target
   * on one and against what residents are asked for on another means one thing
   * on the events list and another on the event itself, which is how two
   * residents come away with different numbers.
   */
  const CALLERS = [
    ['web', 'src', 'app', 'app', '[community]', 'page.tsx'],
    ['web', 'src', 'app', 'app', '[community]', 'events', 'page.tsx'],
    ['web', 'src', 'app', 'app', '[community]', 'events', '[event]', 'page.tsx'],
    ['web', 'src', 'app', 'app', '[community]', 'events', '[event]', 'contribute', 'page.tsx'],
    ['web', 'src', 'app', 'app', '[community]', 'admin', 'page.tsx'],
    ['web', 'src', 'app', 'app', '[community]', 'admin', 'events', '[event]', 'page.tsx'],
    ['mobile', 'app', '(tabs)', 'index.tsx'],
    ['mobile', 'app', '(tabs)', 'events.tsx'],
    ['mobile', 'app', 'event', '[slug].tsx'],
  ];

  it('is told about money carried across everywhere it is drawn', () => {
    const missing = CALLERS.filter((parts) => !read(...parts).includes('fundCarried'));
    expect(missing.map((parts) => parts.join('/'))).toEqual([]);
  });

  it('leads with what residents are asked for, not the target, everywhere it is drawn', () => {
    // An event holding ₹6,990 of a ₹2,00,000 target read "Target ₹2,00,000 ·
    // 0%" over a bar with a sliver in it. The figure is fundAsk: the target
    // less the carry, with the carry said in words beside it.
    const missing = CALLERS.filter((parts) => !read(...parts).includes('fundAsk'));
    expect(missing.map((parts) => parts.join('/'))).toEqual([]);
  });

  it('draws only what residents gave, never the carry as a segment of its own', () => {
    expect(read('web', 'src', 'components', 'badges.tsx')).not.toContain('carriedPercent');
    expect(read('mobile', 'src', 'components', 'event-ui.tsx')).not.toContain('carriedPercent');
  });
});
