import { describe, expect, it } from 'vitest';
import { auditTrail, hasAuditTrail } from '../src/audit';

/**
 * The rule these pin is the one that keeps the column readable: an edit is only
 * worth mentioning when it happened after the approval. Both apps read it from
 * here, so a phone that flags an edit the laptop does not is a disagreement
 * about the society's own records.
 */
const APPROVED = '2026-09-14T10:00:00Z';

describe('auditTrail', () => {
  it('reports the approval on its own when nothing has changed since', () => {
    const facts = auditTrail({ confirmedBy: 'Hana Iyer', confirmedAt: APPROVED });
    expect(facts.confirmed).toEqual({ by: 'Hana Iyer', at: APPROVED });
    expect(facts.editedAfter).toBeNull();
  });

  it('stays quiet about the edit that created the row', () => {
    // updated_at is set when a row is written, so it is at or before the
    // approval on everything nobody has touched since. Flagging those is what
    // teaches people to stop reading the column.
    const facts = auditTrail({
      confirmedBy: 'Hana Iyer',
      confirmedAt: APPROVED,
      editedBy: 'Hana Iyer',
      editedAt: APPROVED,
    });
    expect(facts.editedAfter).toBeNull();
  });

  it('reports an edit made after the approval', () => {
    const later = '2026-09-15T09:30:00Z';
    const facts = auditTrail({
      confirmedBy: 'Hana Iyer',
      confirmedAt: APPROVED,
      editedBy: 'Sam Supervisor',
      editedAt: later,
    });
    expect(facts.editedAfter).toEqual({ by: 'Sam Supervisor', at: later });
  });

  it('ignores an edit recorded before the approval', () => {
    const facts = auditTrail({
      confirmedBy: 'Hana Iyer',
      confirmedAt: APPROVED,
      editedBy: 'Sam Supervisor',
      editedAt: '2026-09-13T08:00:00Z',
    });
    expect(facts.editedAfter).toBeNull();
  });

  it('reports an edit on a record nobody has approved', () => {
    const facts = auditTrail({ editedBy: 'Sam Supervisor', editedAt: APPROVED });
    expect(facts.confirmed).toBeNull();
    expect(facts.editedAfter).toEqual({ by: 'Sam Supervisor', at: APPROVED });
  });

  it('names the system when a confirmation has no person behind it', () => {
    // A seed, an import or the service role reaches succeeded with no
    // membership to name; saying so beats showing nothing.
    expect(auditTrail({ confirmedAt: APPROVED }).confirmed).toEqual({
      by: 'the system',
      at: APPROVED,
    });
  });

  it('does not invent an editor from a timestamp alone', () => {
    expect(
      auditTrail({ confirmedAt: APPROVED, editedAt: '2026-09-16T00:00:00Z' }).editedAfter,
    ).toBeNull();
  });
});

describe('hasAuditTrail', () => {
  it('is false only when there is nothing at all to say', () => {
    expect(hasAuditTrail(auditTrail({}))).toBe(false);
    expect(hasAuditTrail(auditTrail({ editedBy: 'Sam Supervisor' }))).toBe(false);
    expect(hasAuditTrail(auditTrail({ confirmedAt: APPROVED }))).toBe(true);
    expect(hasAuditTrail(auditTrail({ editedBy: 'Sam Supervisor', editedAt: APPROVED }))).toBe(
      true,
    );
  });
});
