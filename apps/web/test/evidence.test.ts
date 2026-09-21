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
