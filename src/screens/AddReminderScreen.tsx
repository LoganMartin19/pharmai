// src/screens/AddReminderScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker, { IOSNativeProps } from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useReminders } from '../context/RemindersContext';
import SafeLayout from '../components/SafeLayout';
import styles from './styles/AddReminderScreen.styles';
import { Medication } from '../types/Medication';
import type { PillStyle } from '../types/PillStyle';
import PillBadge from '../components/PillBadge';
import PillLookPicker from '../components/PillLookPicker';
import { RootStackParamList } from '../navigation/MainNavigator';
import { doseCount } from '../utils/doseSchedule';
import { MedicineSuggestion, searchMedicineNames } from '../utils/medicineDirectory';

type R = RouteProp<RootStackParamList, 'AddReminder'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'AddReminder'>;

function shapeDoseUnit(shape: PillStyle['shape']) {
  if (shape === 'capsule') return 'capsule';
  if (shape === 'round' || shape === 'oval' || shape === 'rectangle') return `${shape} tablet`;
  return 'tablet';
}

function pluralizeDoseUnit(unit: string, count: number) {
  if (count === 1) return unit;
  return unit.endsWith('s') ? unit : `${unit}s`;
}

function doseLabelForShape(shape: PillStyle['shape'], count: number) {
  const unit = shapeDoseUnit(shape);
  return `${count} ${pluralizeDoseUnit(unit, count)}`;
}

function doseCountFromLabel(dosage: string) {
  const match = dosage.match(/^(\d+)\s+/);
  return match ? Number(match[1]) : undefined;
}

function isShapeBasedDosage(dosage: string) {
  return /^(1|2)\s+(?:capsules?|tablets?|round tablets?|oval tablets?|rectangle tablets?)$/i.test(dosage);
}

function frequencyLabel(count: number) {
  if (count <= 1) return 'Once daily';
  if (count === 2) return 'Twice daily';
  if (count === 3) return 'Three times daily';
  if (count === 4) return 'Four times daily';
  return `${count} times daily`;
}

function parseFirstTimeFromPrefill(time?: string | string[]) {
  if (!time) return undefined;
  const raw = Array.isArray(time) ? time[0] : time;
  const first = String(raw).split(',')[0].trim();
  const match = first.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return undefined;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return undefined;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function AddReminderScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { addReminder, updateReminder } = useReminders();

  // If we navigated here to EDIT an existing medication
  const original = route.params?.medication;
  const editing = !!original;

  // If we navigated here from Scan to PREFILL fields
  const prefill = route.params?.prefill ?? {};
  const initialPillStyle = original?.pillStyle ?? (prefill.pillStyle ?? { shape: 'capsule', color: '#2F80ED' });

  // -------- Initial state (edit has priority, then prefill) --------
  const [medicationName, setMedicationName] = useState(
    original?.name ?? (prefill.name ?? '')
  );
  const [showMedicationSuggestions, setShowMedicationSuggestions] = useState(false);
  const [medicationSuggestions, setMedicationSuggestions] = useState<MedicineSuggestion[]>([]);
  const [selectedDosage, setSelectedDosage] = useState(() => {
    const dosage = original?.dosage ?? prefill.dosage ?? doseLabelForShape(initialPillStyle.shape, 1);
    return /^\d+(?:\.\d+)?\s*ml$/i.test(String(dosage)) ? 'Liquid ml' : dosage;
  });
  const [mlAmount, setMlAmount] = useState(() => {
    const dosage = original?.dosage ?? prefill.dosage ?? '';
    const match = String(dosage).match(/^(\d+(?:\.\d+)?)\s*ml$/i);
    return match?.[1] ?? '';
  });
  const [dailyDoseCount, setDailyDoseCount] = useState(() =>
    doseCount(original?.frequency ?? prefill.frequency ?? 'Once daily')
  );
  const [hoursApart, setHoursApart] = useState(() => {
    const count = doseCount(original?.frequency ?? prefill.frequency ?? 'Once daily');
    if (count > 1) return String(Math.max(1, Math.round(24 / count)));
    return '4';
  });

  const initialStart = useMemo(() => {
    // Use the first time from original, then prefill, else now
    return (
      parseFirstTimeFromPrefill(original?.time) ??
      parseFirstTimeFromPrefill(original?.times) ??
      parseFirstTimeFromPrefill(prefill.time) ??
      parseFirstTimeFromPrefill(prefill.times) ??
      new Date()
    );
  }, [original?.time, original?.times, prefill.time, prefill.times]);

  const [startTime, setStartTime] = useState(initialStart);

  const [endDate, setEndDate] = useState(
    original?.endDate
      ? new Date(original.endDate)
      : prefill.endDate
      ? new Date(prefill.endDate)
      : new Date()
  );
  const [repeatPrescription, setRepeatPrescription] = useState(
    original?.repeatPrescription ?? !!prefill.repeatPrescription
  );

  const [pillStyle, setPillStyle] = useState<PillStyle>(
    initialPillStyle
  );

  useEffect(() => {
    const query = medicationName.trim();
    if (query.length < 2 || !showMedicationSuggestions) {
      setMedicationSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchMedicineNames(query);
      if (!cancelled) setMedicationSuggestions(results);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [medicationName, showMedicationSuggestions]);

  const selectedFrequency = frequencyLabel(dailyDoseCount);
  const shapeDosageOptions = useMemo(
    () => [doseLabelForShape(pillStyle.shape, 1), doseLabelForShape(pillStyle.shape, 2)],
    [pillStyle.shape]
  );
  const dosageForSave =
    selectedDosage === 'Liquid ml'
      ? mlAmount.trim()
        ? `${mlAmount.trim()}ml`
        : ''
      : selectedDosage;

  // pickers
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lookPickerVisible, setLookPickerVisible] = useState(false);

  // -------- helpers --------
  const formatDisplayTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatReminderTime = (d: Date) =>
    `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

  const generateDoseTimes = (): string[] => {
    const count = Math.max(1, dailyDoseCount);

    const interval = parseInt(hoursApart || '0', 10);
    const base = new Date(startTime);
    const times: string[] = [];

    for (let i = 0; i < count; i++) {
      const doseTime = new Date(base.getTime() + i * interval * 60 * 60 * 1000);
      times.push(formatReminderTime(doseTime));
    }
    return times;
  };

  const saveReminder = async () => {
    if (!medicationName.trim()) {
      Alert.alert('Missing Info', 'Please enter a medication name');
      return;
    }
    if (!dosageForSave) {
      Alert.alert('Missing Info', 'Please enter the dosage');
      return;
    }

    const times = generateDoseTimes();

    const payload: Medication = {
      id: editing ? original!.id : Date.now().toString(),   // keep the same id when editing
      name: medicationName.trim(),
      dosage: dosageForSave,
      frequency: selectedFrequency,
      time: times.join(', '),
      times,
      instructions: `Take ${dosageForSave}, ${selectedFrequency.toLowerCase()}`,
      repeatPrescription,
      startDate:
        editing
          ? (original?.startDate ?? new Date().toISOString().split('T')[0])
          : new Date().toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      pillStyle,
      history: editing ? (original?.history ?? []) : [],    // preserve history on edit
    };

    if (editing) {
      await updateReminder(payload); // update existing (no duplicate)
    } else {
      await addReminder(payload);    // create new
    }

    if (editing) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  };

  // iOS picker props
  const iosPickerProps: Partial<IOSNativeProps> =
    Platform.OS === 'ios'
      ? { display: 'spinner', themeVariant: 'light', textColor: 'black' as any, style: { height: 216 } }
      : {};

  // -------- UI --------
  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{editing ? 'Edit Reminder' : 'Add Reminder'}</Text>

        <Text style={styles.label}>Medication Name</Text>
        <TextInput
          placeholder="e.g. Paracetamol"
          value={medicationName}
          onFocus={() => setShowMedicationSuggestions(true)}
          onChangeText={(value) => {
            setMedicationName(value);
            setShowMedicationSuggestions(true);
          }}
          style={styles.input}
        />
        {showMedicationSuggestions && medicationSuggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {medicationSuggestions.map((suggestion) => (
              <Pressable
                key={`${suggestion.source}-${suggestion.name}`}
                style={styles.suggestionItem}
                onPress={() => {
                  setMedicationName(suggestion.name);
                  setShowMedicationSuggestions(false);
                }}
              >
                <Text style={styles.suggestionText}>{suggestion.name}</Text>
                <Text style={styles.suggestionSource}>{suggestion.source}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Dosage</Text>
        <View style={styles.optionsRow}>
          {[...shapeDosageOptions, 'Liquid ml'].map((dosage) => (
            <Pressable
              key={dosage}
              style={[styles.optionButton, selectedDosage === dosage && styles.optionButtonSelected]}
              onPress={() => setSelectedDosage(dosage)}
            >
              <Text style={[styles.optionButtonText, selectedDosage === dosage && styles.optionButtonTextSelected]}>
                {dosage}
              </Text>
            </Pressable>
          ))}
        </View>
        {selectedDosage === 'Liquid ml' && (
          <TextInput
            placeholder="e.g. 1.25"
            keyboardType="decimal-pad"
            value={mlAmount}
            onChangeText={(value) => setMlAmount(value.replace(/[^0-9.]/g, ''))}
            style={styles.input}
          />
        )}

        <Text style={styles.label}>Frequency</Text>
        <View style={styles.optionsRow}>
          {[1, 2, 3, 4].map((count) => {
            const freq = frequencyLabel(count);
            return (
              <Pressable
                key={freq}
                style={[styles.optionButton, dailyDoseCount === count && styles.optionButtonSelected]}
                onPress={() => {
                  setDailyDoseCount(count);
                  if (count > 1) setHoursApart(String(Math.max(1, Math.round(24 / count))));
                }}
              >
                <Text style={[styles.optionButtonText, dailyDoseCount === count && styles.optionButtonTextSelected]}>
                  {freq}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Daily Doses</Text>
        <TextInput
          placeholder="e.g. 6"
          keyboardType="number-pad"
          value={String(dailyDoseCount)}
          onChangeText={(value) => {
            const parsed = Number(value.replace(/[^0-9]/g, ''));
            setDailyDoseCount(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
            if (Number.isFinite(parsed) && parsed > 1) {
              setHoursApart(String(Math.max(1, Math.round(24 / parsed))));
            }
          }}
          style={styles.input}
        />

        {dailyDoseCount > 1 && (
          <>
            <Text style={styles.label}>Hours Between Doses</Text>
            <TextInput
              placeholder="e.g. 4"
              keyboardType="numeric"
              value={hoursApart}
              onChangeText={setHoursApart}
              style={styles.input}
            />
          </>
        )}

        <Text style={styles.label}>Start Time</Text>
        <Pressable onPress={() => setShowTimePicker(true)} style={[styles.input, { justifyContent: 'center' }]}>
          <Text>{formatDisplayTime(startTime)}</Text>
        </Pressable>

        <Text style={styles.label}>End Date</Text>
        <Pressable onPress={() => setShowDatePicker(true)} style={[styles.input, { justifyContent: 'center' }]}>
          <Text>{formatDate(endDate)}</Text>
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            onChange={(_, d) => {
              setShowTimePicker(false);
              if (d) setStartTime(d);
            }}
            {...iosPickerProps}
          />
        )}

        {showDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            onChange={(_, d) => {
              setShowDatePicker(false);
              if (d) setEndDate(d);
            }}
            {...iosPickerProps}
            style={Platform.OS === 'ios' ? { height: 300 } : undefined}
          />
        )}

        {/* Pill look row → opens modal */}
        <Text style={styles.label}>Pill Look</Text>
        <Pressable
          onPress={() => setLookPickerVisible(true)}
          style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }]}
        >
          <PillBadge style={pillStyle} size={18} />
          <Text>{pillStyle.shape} • {pillStyle.color}</Text>
          <View style={{ marginLeft: 'auto' }}>
            <Text style={{ color: '#007AFF' }}>Change</Text>
          </View>
        </Pressable>

        <View style={styles.checkboxContainer}>
          <Pressable onPress={() => setRepeatPrescription(!repeatPrescription)} style={styles.checkbox}>
            {repeatPrescription && <Text style={styles.checkmark}>✓</Text>}
          </Pressable>
          <Text style={styles.checkboxLabel}>This is a repeat prescription</Text>
        </View>

        <Pressable style={styles.saveButton} onPress={saveReminder}>
          <Text style={styles.saveButtonText}>{editing ? 'Save Changes' : 'Save'}</Text>
        </Pressable>
      </ScrollView>

      {/* 2‑step shape → color picker */}
      <PillLookPicker
        visible={lookPickerVisible}
        initial={pillStyle}
        onCancel={() => setLookPickerVisible(false)}
        onDone={(style) => {
          if (isShapeBasedDosage(selectedDosage)) {
            setSelectedDosage(doseLabelForShape(style.shape, doseCountFromLabel(selectedDosage) ?? 1));
          }
          setPillStyle(style);
          setLookPickerVisible(false);
        }}
      />
    </SafeLayout>
  );
}
