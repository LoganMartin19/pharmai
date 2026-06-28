import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeLayout from '../components/SafeLayout';
import type { RootStackParamList } from '../navigation/MainNavigator';
import { MedicineSuggestion, isRecognisedMedicineName, searchMedicineNames } from '../utils/medicineDirectory';

type Route = RouteProp<RootStackParamList, 'ScanReview'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'ScanReview'>;
type Frequency = 'Once daily' | 'Twice daily' | 'Three times daily' | 'Four times daily';

const FREQUENCIES: Frequency[] = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily'];

export default function ScanReviewScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { parsed, rawText } = route.params;

  const [name, setName] = useState(parsed.name ?? '');
  const [dosage, setDosage] = useState(parsed.dosage ?? '1 tablet');
  const [frequency, setFrequency] = useState<Frequency>((parsed.frequency as Frequency) ?? 'Once daily');
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const query = name.trim();
    if (query.length < 2 || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchMedicineNames(query);
      if (!cancelled) setSuggestions(results);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, showSuggestions]);

  const continueToReminder = async () => {
    if (!name.trim()) {
      Alert.alert('Medication name needed', 'Please check the scan and enter a medication name.');
      return;
    }

    setChecking(true);
    const recognised = await isRecognisedMedicineName(name);
    setChecking(false);

    if (!recognised) {
      Alert.alert(
        'Medicine not recognised',
        'Please select a medicine from the NHS Scotland Open Data suggestions before continuing.'
      );
      setShowSuggestions(true);
      return;
    }

    navigation.navigate('AddReminder', {
      prefill: {
        name: name.trim(),
        dosage: dosage.trim() || '1 tablet',
        frequency,
      },
    });
  };

  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={styles.title}>Check scan</Text>
        <Text style={styles.subtitle}>Confirm the details before creating a reminder.</Text>

        <Text style={styles.label}>Medication name</Text>
        <TextInput
          value={name}
          onFocus={() => setShowSuggestions(true)}
          onChangeText={(value) => {
            setName(value);
            setShowSuggestions(true);
          }}
          placeholder="e.g. Amoxicillin"
          style={styles.input}
        />
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={`${suggestion.source}-${suggestion.name}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setName(suggestion.name);
                  setShowSuggestions(false);
                }}
              >
                <Text style={styles.suggestionText}>{suggestion.name}</Text>
                <Text style={styles.suggestionSource}>{suggestion.source}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Dosage</Text>
        <TextInput value={dosage} onChangeText={setDosage} placeholder="e.g. 500 mg" style={styles.input} />

        <Text style={styles.label}>Frequency</Text>
        <View style={styles.optionRow}>
          {FREQUENCIES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setFrequency(option)}
              style={[styles.option, frequency === option && styles.optionSelected]}
            >
              <Text style={[styles.optionText, frequency === option && styles.optionTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Recognised text</Text>
        <View style={styles.rawBox}>
          <Text style={styles.rawText}>{rawText || 'No OCR text available.'}</Text>
        </View>

        <Pressable style={[styles.primaryButton, checking && styles.primaryButtonDisabled]} disabled={checking} onPress={continueToReminder}>
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </Pressable>
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { color: '#6B7280', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionText: { color: '#111827', fontSize: 15, fontWeight: '700' },
  suggestionSource: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  optionSelected: { borderColor: '#0A84FF', backgroundColor: '#E8F0FF' },
  optionText: { color: '#374151', fontWeight: '700' },
  optionTextSelected: { color: '#0A84FF' },
  rawBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    maxHeight: 220,
  },
  rawText: { color: '#4B5563', lineHeight: 20 },
  primaryButton: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
