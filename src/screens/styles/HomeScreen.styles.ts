import { StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing, type } from '../../theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  greeting: {
    ...type.hero,
    color: colors.ink,
    marginTop: 7,
  },
  subtitle: {
    ...type.body,
    color: colors.inkMuted,
    marginTop: 5,
  },
  list: {
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardPressed: { opacity: .92, transform: [{ scale: .995 }] },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medHeading: { flex: 1 },
  medIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  medName: {
    ...type.heading,
    color: colors.ink,
  },
  instructions: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  time: {
    ...type.caption,
    color: colors.inkMuted,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  button: {
    backgroundColor: colors.blueSoft,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  buttonTaken: {
    backgroundColor: colors.brandSoft,
  },
  buttonText: {
    color: colors.blue,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonTextTaken: {
    color: colors.brandDark,
  },

  addButton: {
    position: 'absolute',
    bottom: 92,
    right: 20,
    backgroundColor: colors.brand,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    //shadowColor: '#000',
    //shadowOpacity: 0.2,
    //shadowRadius: 4,
    //shadowOffset: { width: 0, height: 2 },
  },

  trackerButton: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackerButtonText: {
    color: colors.brand,
    ...type.label,
  },
});

export default styles;
