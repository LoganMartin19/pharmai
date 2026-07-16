import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, shadow, spacing, type } from '../theme';

export function Surface({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function IconButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name={icon} size={21} color={colors.ink}/></Pressable>;
}

export function StatusPill({ label, tone='brand' }: { label: string; tone?: 'brand'|'amber'|'blue' }) {
  return <View style={[styles.pill, tone==='amber'&&styles.pillAmber, tone==='blue'&&styles.pillBlue]}><Text style={[styles.pillText, tone==='amber'&&styles.pillTextAmber, tone==='blue'&&styles.pillTextBlue]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.lg, ...shadow.card },
  eyebrow: { ...type.caption, color: colors.brand, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  pressed: { opacity: .65, transform: [{ scale: .97 }] },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.brandSoft },
  pillAmber: { backgroundColor: colors.amberSoft }, pillBlue: { backgroundColor: colors.blueSoft },
  pillText: { ...type.caption, color: colors.brandDark, fontWeight: '800' }, pillTextAmber: { color: colors.amber }, pillTextBlue: { color: colors.blue },
});
