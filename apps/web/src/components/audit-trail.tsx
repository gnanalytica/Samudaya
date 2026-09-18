import { relativeTime } from '@samudaya/core';

/**
 * Who approved this, when, and whether anybody has changed it since.
 *
 * The four facts a society argues about a year later, in the place the argument
 * happens — next to the record itself, rather than in a log somebody has to go
 * and find. The log behind it (audit_log) holds the before-and-after of every
 * field and is staff-only; this is the part that belongs on screen.
 *
 * An edit is only worth mentioning when it happened after the approval. Every
 * row has been "modified" at the moment it was made, and saying so on every
 * line teaches people to stop reading the column.
 */
export function AuditTrail({
  confirmedBy,
  confirmedAt,
  editedBy,
  editedAt,
  confirmedLabel = 'Confirmed',
}: {
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  editedBy?: string | null;
  editedAt?: string | null;
  /** "Approved" reads better on a bill than "Confirmed". */
  confirmedLabel?: string;
}) {
  const editedAfter =
    editedAt && editedBy && (!confirmedAt || new Date(editedAt) > new Date(confirmedAt))
      ? editedAt
      : null;

  if (!confirmedAt && !editedAfter) return <span className="text-ink-subtle">—</span>;

  return (
    <span className="block space-y-0.5">
      {confirmedAt ? (
        <span className="block">
          {confirmedLabel} by {confirmedBy ?? 'the system'} · {relativeTime(confirmedAt)}
        </span>
      ) : null}
      {editedAfter ? (
        <span className="text-warning block">
          Edited by {editedBy} · {relativeTime(editedAfter)}
        </span>
      ) : null}
    </span>
  );
}
