import { Redirect } from 'expo-router';

/**
 * The tab bar's Contribute button needs a route of its own to sit on. Pressing
 * it opens /contribute over the tabs instead, so this only runs if something
 * links here directly.
 */
export default function Give() {
  return <Redirect href="/contribute" />;
}
