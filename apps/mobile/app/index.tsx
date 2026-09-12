import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { Loading, Screen } from '../src/components/ui';

/**
 * Entry point. Decides where the user belongs once the stored session has been
 * read — signed out, no community yet, or straight into the app.
 */
export default function Index() {
  const { loading, user, memberships } = useAuth();

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!user) return <Redirect href="/sign-in" />;
  if (memberships.length === 0) return <Redirect href="/join" />;
  return <Redirect href="/(tabs)" />;
}
