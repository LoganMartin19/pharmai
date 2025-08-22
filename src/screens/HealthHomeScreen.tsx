// src/screens/HealthHomeScreen.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HealthRoutes } from '../navigation/HealthNavigator';

type Nav = NativeStackNavigationProp<HealthRoutes, 'HealthHome'>;

function Row({
  title,
  subtitle,
  emoji,
  onPress,
}: {
  title: string;
  subtitle?: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function HealthHomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Health</Text>

        <View style={styles.card}>
          <Row
            emoji="🩸"
            title="Menstrual cycle"
            subtitle="Log periods, see predictions & next cycle"
            onPress={() => navigation.navigate('Menstrual')}
          />
          <Row
            emoji="⌚️"
            title="Wearables"
            subtitle="Connect Apple Health / Garmin (coming soon)"
            onPress={() => navigation.navigate('Wearables')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { paddingHorizontal: 16, paddingTop: 10 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#eef2f7',
  },
  emoji: { fontSize: 22, marginRight: 12 },
  rowTitle: { fontWeight: '700', fontSize: 16 },
  rowSubtitle: { color: '#667085', marginTop: 2 },
  chevron: { color: '#98a2b3', fontSize: 18 },
});