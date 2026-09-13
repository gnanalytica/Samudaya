import { Redirect } from 'expo-router';

/**
 * Committee decisions used to live here. Campaigns and suggestions are now in
 * the To do queue on the Manage tab, alongside payments, bills and join
 * requests; old links and notifications land there.
 */
export default function CommitteeQueue() {
  return <Redirect href="/manage" />;
}
