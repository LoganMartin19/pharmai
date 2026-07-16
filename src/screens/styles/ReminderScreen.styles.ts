// src/screens/styles/ReminderScreen.styles.ts
import { StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing, type } from '../../theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60, // or use useSafeAreaInsets() for dynamic padding
    backgroundColor: colors.background,
  },
  title: {
    ...type.hero,
    color: colors.ink,
    textAlign: 'left',
  },
  list: {
    paddingBottom: 120,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: 12,
    ...shadow.card,
  },
  name: {
    ...type.heading,
    color: colors.ink,
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 2,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    backgroundColor: colors.brand,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    width: '85%',
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  trackerButton: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackerButtonText: {
    fontSize: 14,
    color: colors.brandDark,
  },
  header: { marginBottom: 20 },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  deleteButton: { backgroundColor: colors.dangerSoft, marginTop: 8 },
});

export default styles;
