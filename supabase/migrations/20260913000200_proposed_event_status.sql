-- ============================================================================
-- Samudaya · 20260913000200 · 'proposed' event status
-- ----------------------------------------------------------------------------
-- A fundraising campaign a resident proposes waits in 'proposed' until the
-- committee approves it. Kept in its own migration: a new enum value cannot be
-- used in the same transaction that adds it.
-- ============================================================================

alter type public.event_status add value if not exists 'proposed' before 'draft';
