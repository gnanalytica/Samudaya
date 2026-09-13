import { Redirect } from 'expo-router';

/**
 * The old More tab. Its rows moved to Me (profile, payments, societies) and
 * Manage (everything staff and the committee run); old links land on Me.
 */
export default function More() {
  return <Redirect href="/me" />;
}
