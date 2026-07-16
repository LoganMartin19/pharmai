import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
};

export default function SafeLayout({ children, style, scroll = false }: Props) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={[styles.container, style]}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
