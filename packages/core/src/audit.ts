/**
 * Who approved a record, when, and whether anybody has changed it since.
 *
 * The four facts a society argues about a year later. The rule that makes them
 * readable is the one worth sharing: **an edit is only worth mentioning when it
 * happened after the approval**. Every row has been "modified" at the moment it
 * was made, and a screen that says so on every line teaches people to stop
 * reading the column — at which point the one edit that mattered goes past
 * unread too.
 *
 * It lives here rather than in either app because the web shows this on the
 * event page and the phone shows it on Payments and Bills, and a phone that
 * flags an edit the laptop does not is a disagreement about the society's
 * records, which is exactly what an audit trail exists to prevent.
 *
 * The log behind it (`audit_log`) holds the before-and-after of every field and
 * is staff-only; this is the part that belongs on screen.
 */

export type AuditFact = { by: string; at: string };

export type AuditTrailFacts = {
  /** Present once somebody has confirmed or approved the record. */
  confirmed: AuditFact | null;
  /** Present only for an edit made *after* that confirmation. */
  editedAfter: AuditFact | null;
};

export type AuditTrailInput = {
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  editedBy?: string | null;
  editedAt?: string | null;
};

/**
 * Reduces the four raw columns to what a screen should actually say.
 *
 * An unnamed confirmer becomes "the system" rather than being dropped: a row
 * that reached `succeeded` through a seed, an import or the service role has no
 * person behind it, and saying so is more honest than showing nothing.
 */
export function auditTrail({
  confirmedBy,
  confirmedAt,
  editedBy,
  editedAt,
}: AuditTrailInput): AuditTrailFacts {
  const confirmed: AuditFact | null = confirmedAt
    ? { by: confirmedBy ?? 'the system', at: confirmedAt }
    : null;

  const editedAfter: AuditFact | null =
    editedAt && editedBy && (!confirmedAt || new Date(editedAt) > new Date(confirmedAt))
      ? { by: editedBy, at: editedAt }
      : null;

  return { confirmed, editedAfter };
}

/** Whether there is anything to show at all, so a caller can render a dash. */
export function hasAuditTrail(facts: AuditTrailFacts): boolean {
  return facts.confirmed !== null || facts.editedAfter !== null;
}
