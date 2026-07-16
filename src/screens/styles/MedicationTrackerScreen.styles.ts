import { StyleSheet } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...type.title,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  dayContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
    color: colors.ink,
  },
  missed: {
    color: colors.danger,
  },
  progressBar: {
    width: '100%',
    height: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.brand,
  },
  progressText: {
    marginTop: 4,
    fontSize: 13,
    color: colors.inkMuted,
  },
});
