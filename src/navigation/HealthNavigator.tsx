// src/navigation/HealthNavigator.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenstrualTrackerScreen from '../screens/MenstrualTrackerScreen';
import HealthIntegrationsScreen from '../screens/HealthIntegrationsScreen';
import { useUser } from '../context/UserContext';
import SafeLayout from '../components/SafeLayout';
import { Eyebrow } from '../components/Primitives';
import { colors, radius, shadow, spacing, type } from '../theme';

export type HealthRoutes = {
  HealthHome: undefined;
  Menstrual: undefined;
  Wearables: undefined;
};

const Stack = createNativeStackNavigator<HealthRoutes>();

function Row({
  title,
  subtitle,
  onPress,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.icon}><Ionicons name={icon} size={22} color={colors.brandDark} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.inkMuted} />
    </Pressable>
  );
}

function HealthHomeScreen({ navigation }: any) {
  const { user } = useUser();
  const canAccessCycle = user?.gender === 'female';

  return (
    <SafeLayout>
      <View style={styles.content}>
        <Eyebrow>HEALTH HUB</Eyebrow>
        <Text style={styles.title}>Your health, connected</Text>
        <Text style={styles.subtitle}>Bring your cycle and wearable insights together in one private view.</Text>
        <View style={styles.card}>
          {canAccessCycle ? (
            <Row
              icon="calendar-outline"
              title="Cycle tracker"
              subtitle="Log periods, ovulation, symptoms & predictions"
              onPress={() => navigation.navigate('Menstrual')}
            />
          ) : (
            <View style={styles.unavailable}>
              <Text style={styles.rowTitle}>Cycle tracker</Text>
              <Text style={styles.rowSubtitle}>
                Available when Gender is set to Woman in Settings.
              </Text>
            </View>
          )}
          <Row
            icon="watch-outline"
            title="Wearables"
            subtitle="Connect Apple Health / Garmin (coming soon)"
            onPress={() => navigation.navigate('Wearables')}
          />
        </View>
      </View>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.background },
  title: { ...type.title, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.lg, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.line },
  icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft, marginRight: spacing.md },
  rowTitle: { ...type.heading, color: colors.ink },
  rowSubtitle: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
  unavailable: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.line },
});

export default function HealthNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HealthHome"
        component={HealthHomeScreen}
        options={{ title: 'Health' }}
      />
      <Stack.Screen
        name="Menstrual"
        component={MenstrualTrackerScreen}
        options={{ title: 'Menstrual cycle' }}
      />
      <Stack.Screen
        name="Wearables"
        component={HealthIntegrationsScreen}
        options={{ title: 'Wearables' }}
      />
    </Stack.Navigator>
  );
}
