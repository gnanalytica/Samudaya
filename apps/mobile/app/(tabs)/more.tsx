import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ROLE_LABEL, formatMoney, invoiceRef } from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

export default function More() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, activeCommunity, role, memberships, setActiveCommunity, signOut } = useAuth();

  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const { data, loading, refreshing, refresh } = useCommunityData('more', async (communityId) => {
    const [invoices, link] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, number, title, balance_due, due_date, status')
        .eq('community_id', communityId)
        .in('status', ['issued', 'partly_paid', 'overdue'])
        .order('due_date')
        .limit(10),
      supabase.from('whatsapp_links').select('phone, verified_at').maybeSingle(),
    ]);
    return {
      invoices: invoices.data ?? [],
      linkedPhone: link.data?.verified_at ? link.data.phone : null,
    };
  });

  const requestLinkCode = async () => {
    if (!activeCommunity) return;
    setLinking(true);
    const { data: code, error } = await supabase.rpc('create_whatsapp_link_code', {
      p_community_id: activeCommunity.id,
    });
    setLinking(false);
    if (error || !code) {
      Alert.alert('Could not create a code', 'Please try again in a moment.');
      return;
    }
    setLinkCode(code.code);
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const outstanding = (data?.invoices ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.balance_due ?? 0),
    0,
  );
  const currency = activeCommunity?.currency ?? 'INR';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: spacing.xs }}>
          <Title>{profile?.full_name ?? 'You'}</Title>
          <Caption>
            {activeCommunity?.name}
            {role ? ` · ${ROLE_LABEL[role]}` : ''}
          </Caption>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Heading>Dues</Heading>
          <Title>{formatMoney(outstanding, currency)}</Title>
          {data?.invoices.length ? (
            data.invoices.map((invoice) => (
              <View
                key={invoice.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{invoice.title}</Body>
                  <Caption>
                    {invoiceRef(invoice.number)} · due {invoice.due_date}
                  </Caption>
                </View>
                <Body>{formatMoney(invoice.balance_due, currency)}</Body>
              </View>
            ))
          ) : (
            <Body muted>Nothing outstanding — you’re all settled up.</Body>
          )}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Heading>WhatsApp</Heading>
            <Badge
              label={data?.linkedPhone ? 'Linked' : 'Not linked'}
              tone={data?.linkedPhone ? 'success' : 'neutral'}
            />
          </View>
          {data?.linkedPhone ? (
            <Body muted>
              Linked to {data.linkedPhone}. Send “help” to the bot to see what it can do.
            </Body>
          ) : linkCode ? (
            <View style={{ gap: spacing.xs }}>
              <Caption>SEND THIS TO THE COMMUNITY BOT</Caption>
              <Title>link {linkCode}</Title>
              <Caption>From the number you want to link. Good for 15 minutes.</Caption>
            </View>
          ) : (
            <>
              <Body muted>
                Report issues and check dues over WhatsApp, without opening the app.
              </Body>
              <Button label="Get a link code" onPress={requestLinkCode} loading={linking} />
            </>
          )}
        </Card>

        {memberships.length > 1 ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Switch community</Heading>
            {memberships.map((membership) => {
              const isActive = membership.community_id === activeCommunity?.id;
              return (
                <Pressable
                  key={membership.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setActiveCommunity(membership.community_id)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Body>{membership.communities?.name ?? 'Community'}</Body>
                  {isActive ? <Body muted>Current</Body> : null}
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        <Button
          label="Join another community"
          variant="secondary"
          onPress={() => router.push('/join')}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert('Sign out?', 'You’ll need to sign in again to use the app.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={{ paddingVertical: spacing.md, alignItems: 'center' }}
        >
          <Body muted>Sign out</Body>
        </Pressable>
        {/* Clears the tab bar so the last row is never half-hidden behind it. */}
        <View style={{ height: spacing.xl, backgroundColor: colors.surface }} />
      </ScrollView>
    </Screen>
  );
}
