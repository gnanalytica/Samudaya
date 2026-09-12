'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

/**
 * The gate desk is usually a shared tablet, so this stays a plain form: no
 * debounce, no live search, one deliberate submit per visitor.
 */
export function GateSearch({ slug, defaultValue }: { slug: string; defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(
          query ? `/app/${slug}/gate?q=${encodeURIComponent(query)}` : `/app/${slug}/gate`,
        );
      }}
      className="flex gap-2"
      role="search"
    >
      <label htmlFor="gate-search" className="sr-only">
        Gate code or visitor name
      </label>
      <Input
        id="gate-search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Gate code or name"
        autoComplete="off"
        inputMode="text"
        className="font-mono tracking-widest"
      />
      <Button type="submit" variant="secondary">
        <Search className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Find</span>
      </Button>
    </form>
  );
}
