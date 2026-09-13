'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Keeps the sidebar and navigation usable when one page fails, so a member can
 * retry or go elsewhere instead of facing a blank screen.
 */
export default function CommunityError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title="This page didn’t load"
      description={
        error.digest
          ? `Check your connection and try again. If it keeps happening, share code ${error.digest}.`
          : 'Check your connection and try again.'
      }
      action={
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  );
}
