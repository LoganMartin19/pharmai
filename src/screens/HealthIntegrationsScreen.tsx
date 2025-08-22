// src/screens/HealthIntegrationsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import SafeLayout from '../components/SafeLayout';

export default function HealthIntegrationsScreen() {
  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text style={s.title}>Wearables & Health Data</Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Apple Health (coming soon)</Text>
          <Text style={s.muted}>
            Sync cycle logs and heart‑rate trends from Apple Health to improve predictions.
          </Text>
          <Pressable style={[s.btn, s.btnDisabled]}>
            <Text style={s.btnText}>Connect Apple Health</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Garmin (coming soon)</Text>
          <Text style={s.muted}>
            Pull sleep and HRV insights from Garmin Connect to refine symptom forecasts.
          </Text>
          <Pressable style={[s.btn, s.btnDisabled]}>
            <Text style={s.btnText}>Connect Garmin</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Why connect?</Text>
          <Text style={s.muted}>
            Wearable data helps estimate cycle phases more accurately and can warn you of
            likely heavier days in advance.
          </Text>
          <Pressable
            style={[s.btn, { backgroundColor: '#E8F0FF' }]}
            onPress={() => Linking.openURL('https://support.apple.com/guide/health/welcome/ios')}
          >
            <Text style={[s.btnText, { color: '#0A84FF' }]}>Learn about Apple Health</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeLayout>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginVertical: 8 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6, color: '#0f172a' },
  muted: { color: '#64748b', marginBottom: 10 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#f1f5f9' },
  btnText: { color: '#0f172a', fontWeight: '800' },
});