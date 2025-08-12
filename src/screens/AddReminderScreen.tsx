// src/screens/AddReminderScreen.tsx
import React, { useMemo, useState } from 'react';
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

import { useReminders } from '../context/RemindersContext';
import SafeLayout from '../components/SafeLayout';
import styles from './styles/AddReminderScreen.styles';
import { Medication } from '../types/Medication';
import type { PillStyle } from '../types/PillStyle';
import PillBadge from '../components/PillBadge';
import PillLookPicker from '../components/PillLookPicker';
import { RootStackParamList } from '../navigation/MainNavigator';

type Freq = 'Once daily' | 'Twice daily' | 'Three times daily';

function parseFirstTimeFromPrefill(time?: string | string[]) {
  if (!time) return undefined;
  const raw = Array.isArray(time) ? time[0] : time;
  const first = String(raw).split(',')[0].trim();
  const [h, m] = first.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function AddReminderScreen() {
  const { addReminder } = useReminders();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddReminder'>>();
  const prefill = route.params?.prefill ?? {};

  // -------- Initial state (prefill-aware) --------
  const [medicationName, setMedicationName] = useState(prefill.name ?? '');
  const [selectedDosage, setSelectedDosage] = useState(prefill.dosage ?? '1 tablet');
  const [selectedFrequency, setSelectedFrequency] = useState<Freq>(
    (prefill.frequency as Freq) ?? 'Once daily'
  );
  const [hoursApart, setHoursApart] = useState('4');

  const initialStart = useMemo(
    () => parseFirstTimeFromPrefill(prefill.time) ?? new Date(),
    [prefill.time]
  );
  const [startTime, setStartTime] = useState(initialStart);

  const [endDate, setEndDate] = useState(
    prefill.endDate ? new Date(prefill.endDate) : new Date()
  );
  const [repeatPrescription, setRepeatPrescription] = useState(!!prefill.repeatPrescription);

  const [pillStyle, setPillStyle] = useState<PillStyle>(
    prefill.pillStyle ?? { shape: 'capsule', color: '#2F80ED' }
  );

  // pickers
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lookPickerVisible, setLookPickerVisible] = useState(false);

  // -------- helpers --------
  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

  const generateDoseTimes = (): string[] => {
    const count =
      selectedFrequency === 'Twice daily'
        ? 2
        : selectedFrequency === 'Three times daily'
        ? 3
        : 1;

    const interval = parseInt(hoursApart || '0', 10);
    const base = new Date(startTime);
    const times: string[] = [];

    for (let i = 0; i < count; i++) {
      const doseTime = new Date(base.getTime() + i * interval * 60 * 60 * 1000);
      times.push(formatTime(doseTime));
    }
    return times;
  };

  const saveReminder = () => {
    if (!medicationName.trim()) {
      Alert.alert('Missing Info', 'Please enter a medication name');
      return;
    }

    const times = generateDoseTimes();

    const item: Medication = {
      id: Date.now().toString(),
      name: medicationName.trim(),
      dosage: selectedDosage,
      frequency: selectedFrequency,
      time: times.join(', '),
      instructions: `Take ${selectedDosage}, ${selectedFrequency.toLowerCase()}`,
      repeatPrescription,
      startDate: new Date().toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      pillStyle,               // ✅ persist chosen look
      history: [],
    };

    addReminder(item);
    navigation.goBack();
  };

  // iOS picker props
  const iosPickerProps: Partial<IOSNativeProps> =
    Platform.OS === 'ios'
      ? { display: 'spinner', themeVariant: 'light', textColor: 'black' as any, style: { height: 216 } }
      : {};

  // -------- UI --------
  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Add Reminder</Text>

        <Text style={styles.label}>Medication Name</Text>
        <TextInput
          placeholder="e.g. Paracetamol"
          value={medicationName}
          onChangeText={setMedicationName}
          style={styles.input}
        />

        <Text style={styles.label}>Dosage</Text>
        <View style={styles.optionsRow}>
          {['1 tablet', '2 tablets', '5ml', '10ml'].map((dosage) => (
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

        <Text style={styles.label}>Frequency</Text>
        <View style={styles.optionsRow}>
          {(['Once daily', 'Twice daily', 'Three times daily'] as const).map((freq) => (
            <Pressable
              key={freq}
              style={[styles.optionButton, selectedFrequency === freq && styles.optionButtonSelected]}
              onPress={() => setSelectedFrequency(freq)}
            >
              <Text style={[styles.optionButtonText, selectedFrequency === freq && styles.optionButtonTextSelected]}>
                {freq}
              </Text>
            </Pressable>
          ))}
        </View>

        {(selectedFrequency === 'Twice daily' || selectedFrequency === 'Three times daily') && (
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
          <Text>{formatTime(startTime)}</Text>
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
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </ScrollView>

      {/* 2‑step shape → color picker */}
      <PillLookPicker
        visible={lookPickerVisible}
        initial={pillStyle}
        onCancel={() => setLookPickerVisible(false)}
        onDone={(style) => {
          setPillStyle(style);
          setLookPickerVisible(false);
        }}
      />
    </SafeLayout>
  );
}