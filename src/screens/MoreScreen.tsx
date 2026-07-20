import React from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeLayout from '../components/SafeLayout';
import { Eyebrow } from '../components/Primitives';
import type { RootStackParamList } from '../navigation/MainNavigator';
import { colors, radius, shadow, spacing, type } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const destinations = [
  { route: 'Chat', title: 'Ask PharmAI', subtitle: 'Questions and previous conversations', icon: 'chatbubble-ellipses-outline' },
  { route: 'Pharmacy', title: 'Pharmacies', subtitle: 'Nearby services and refill requests', icon: 'medical-outline' },
  { route: 'Refills', title: 'Refills', subtitle: 'Manage repeat medication requests', icon: 'repeat-outline' },
  { route: 'Health', title: 'Health', subtitle: 'Cycle and connected health tools', icon: 'heart-outline' },
  { route: 'CareLink', title: 'Care circle', subtitle: 'Share progress with someone you trust', icon: 'people-outline' },
  { route: 'Settings', title: 'Settings', subtitle: 'Account, notifications and privacy', icon: 'settings-outline' },
] as const;

export default function MoreScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={styles.content}>
        <Eyebrow>PHARMAI</Eyebrow>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Support, pharmacy services and account tools—kept out of the way until you need them.</Text>
        <View style={styles.card}>
          {destinations.map((item, index) => (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              onPress={() => navigation.navigate(item.route)}
              style={[styles.row, index === destinations.length - 1 && styles.lastRow]}
            >
              <View style={styles.iconWrap}><Ionicons name={item.icon} size={22} color={colors.brand} /></View>
              <View style={styles.copy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowSubtitle}>{item.subtitle}</Text></View>
              <Ionicons name="chevron-forward" size={19} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 110 },
  title: { ...type.hero, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.lg, ...shadow.card },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  lastRow: { borderBottomWidth: 0 },
  iconWrap: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  rowTitle: { ...type.heading, fontSize: 16, color: colors.ink },
  rowSubtitle: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
});
