#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fails when supabase/migrations holds a migration the target database has not
# applied.
#
# The app and its schema travel separately: Vercel deploys on merge, migrations
# wait for someone to run `pnpm db:push`. On 14 September the web app shipped
# without 20260914000100 and society creation answered every founder with
# "Something went wrong. Please try again." for a day and a half — invisible in
# the error dashboard, because the failure was caught and shown as form state.
# This is the check that would have caught it within a minute of the merge.
#
#   SUPABASE_DB_URL='postgresql://…' pnpm db:status
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/supabase/migrations"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "✗ SUPABASE_DB_URL is not set, so nothing was checked."
  echo
  echo "  CI reads it from a repository secret; it is the database connection"
  echo "  string under Supabase → Project Settings → Database. This fails rather"
  echo "  than skips on purpose: a check that quietly does nothing is the bug"
  echo "  it exists to catch."
  exit 1
fi

repo=$(cd "$DIR" && ls ./*.sql 2>/dev/null | xargs -n1 basename | sed 's/_.*//' | sort)
if [ -z "$repo" ]; then
  echo "✗ No migrations found in supabase/migrations."
  exit 1
fi

if ! applied=$(psql "$SUPABASE_DB_URL" -tAc \
  'select version from supabase_migrations.schema_migrations' 2>&1); then
  echo "✗ Could not read supabase_migrations.schema_migrations:"
  echo "    $applied"
  exit 1
fi
applied=$(echo "$applied" | sed '/^$/d' | sort)

pending=$(comm -23 <(echo "$repo") <(echo "$applied"))
# The other direction is a migration applied by hand, or under a version the
# repository does not use. Worth saying, not worth failing over.
extra=$(comm -13 <(echo "$repo") <(echo "$applied"))

if [ -n "$extra" ]; then
  echo "! Applied on the database but not in the repository:"
  while read -r version; do
    [ -n "$version" ] && echo "    $version"
  done <<<"$extra"
  echo
fi

if [ -z "$pending" ]; then
  echo "✓ The database has all $(echo "$repo" | wc -l | tr -d ' ') migrations."
  exit 0
fi

echo "✗ The database is behind the repository:"
while read -r version; do
  [ -n "$version" ] || continue
  file=$(cd "$DIR" && ls "${version}"_*.sql 2>/dev/null | head -1)
  echo "    $version  ${file:-(no matching file)}"
done <<<"$pending"
echo
echo "  Apply them with:  pnpm db:push"
echo
echo "  Until then, whatever they add — a function, a policy, a column — is"
echo "  missing in production, and the app fails against it at runtime."
exit 1
