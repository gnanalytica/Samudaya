import { notFound } from 'next/navigation';

/**
 * Hidden for the pilot: the app runs on events, budgets, spending, suggestions
 * and campaigns only. The data and actions are kept so this can return.
 */
export default function HiddenPage() {
  notFound();
}
