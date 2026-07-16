import { StyleSheet } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';

export default StyleSheet.create({
  title: {
    ...type.hero,
    color:colors.ink,
    marginTop:7,
    marginBottom: 20,
  },
  label: {
    ...type.label,
    marginTop: 16,
    marginBottom: 6,
    color: colors.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionSource: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor:colors.surface,
    marginRight: 10,
    marginBottom: 10,
  },
  optionButtonSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  optionButtonText: {
    fontSize: 14,
    color: colors.ink,
  },
  optionButtonTextSelected: {
    color: colors.brandDark,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  chatPrompt: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    borderRadius: radius.lg,
    marginTop: 30,
    alignItems: 'center',
  },
  chatIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  chatText: {
    fontSize: 14,
    color: '#333',
    flexShrink: 1,
  },
  saveButton: {
    backgroundColor: colors.brand,
    paddingVertical: 15,
    borderRadius: radius.pill,
    marginTop: 30,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkmark: {
    fontSize: 16,
    color: '#007aff',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
});
