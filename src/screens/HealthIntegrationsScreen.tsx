// src/screens/HealthIntegrationsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import SafeLayout from '../components/SafeLayout';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Eyebrow } from '../components/Primitives';
import { colors, radius, shadow, spacing, type } from '../theme';

export default function HealthIntegrationsScreen() {
  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={s.content}>
        <Eyebrow>CONNECTED HEALTH</Eyebrow>
        <Text style={s.title}>Wearables & health data</Text>
        <Text style={s.subtitle}>Choose what to connect. PharmAI never shares this data without your permission.</Text>

        <View style={s.card}>
          <View style={s.cardHeader}><View style={s.icon}><Ionicons name="heart-outline" size={22} color={colors.brandDark} /></View><Text style={s.cardTitle}>Apple Health</Text></View>
          <Text style={s.muted}>
            Sync cycle logs and heart‑rate trends from Apple Health to improve predictions.
          </Text>
          <Pressable disabled style={[s.btn, s.btnDisabled]}>
            <Text style={s.btnText}>Coming soon</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}><View style={s.icon}><Ionicons name="watch-outline" size={22} color={colors.brandDark} /></View><Text style={s.cardTitle}>Garmin</Text></View>
          <Text style={s.muted}>
            Pull sleep and HRV insights from Garmin Connect to refine symptom forecasts.
          </Text>
          <Pressable disabled style={[s.btn, s.btnDisabled]}>
            <Text style={s.btnText}>Coming soon</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Why connect?</Text>
          <Text style={s.muted}>
            Wearable data helps estimate cycle phases more accurately and can warn you of
            likely heavier days in advance.
          </Text>
          <Pressable
            style={[s.btn, s.learnBtn]}
            onPress={() => Linking.openURL('https://support.apple.com/guide/health/welcome/ios')}
          >
            <Text style={s.learnBtnText}>Learn about Apple Health</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeLayout>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  title: { ...type.title, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...type.heading, color: colors.ink },
  muted: { ...type.body, color: colors.inkMuted, marginBottom: spacing.md },
  btn: { paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  btnDisabled: { backgroundColor: colors.surfaceMuted },
  btnText: { color: colors.inkMuted, fontWeight: '800' },
  learnBtn: { backgroundColor: colors.brandSoft },
  learnBtnText: { color: colors.brandDark, fontWeight: '800' },
});
