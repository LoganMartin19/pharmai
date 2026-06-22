// src/screens/MenstrualTrackerScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import SafeLayout from '../components/SafeLayout';
import CycleSummaryCard from '../components/CycleSummaryCard';

type Flow = 'light' | 'medium' | 'heavy';
type Symptom = 'cramps' | 'headache' | 'bloating' | 'mood' | 'fatigue' | 'tenderness';

type Cycle = {
  id: string;
  startDate: string;
  heavyDate?: string;
  lastDate?: string;
  flow?: Flow;
  symptoms?: Symptom[];
  notes?: string;
};

const STORAGE_KEY = 'menstrual:cycles';
const FLOW_OPTIONS: Array<{ value: Flow; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];
const SYMPTOMS: Array<{ value: Symptom; label: string }> = [
  { value: 'cramps', label: 'Cramps' },
  { value: 'headache', label: 'Headache' },
  { value: 'bloating', label: 'Bloating' },
  { value: 'mood', label: 'Mood' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'tenderness', label: 'Tenderness' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isISODate(s?: string) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDate(s: string) {
  return new Date(`${s}T00:00:00`);
}

function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

function addDays(s: string, n: number) {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function friendlyDate(s?: string) {
  if (!s) return '-';
  return toDate(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function sortCycles(rows: Cycle[]) {
  return [...rows].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export default function MenstrualTrackerScreen() {
  const navigation = useNavigation<any>();

  const [startDate, setStartDate] = useState(todayISO());
  const [heavyDate, setHeavyDate] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [flow, setFlow] = useState<Flow>('medium');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const arr: Cycle[] = raw ? JSON.parse(raw) : [];
        setCycles(sortCycles(arr));
      } catch (e) {
        console.warn('load cycles failed', e);
      }
    })();
  }, []);

  async function persist(next: Cycle[]) {
    const sorted = sortCycles(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    setCycles(sorted);
  }

  function loadCycle(entry: Cycle) {
    setStartDate(entry.startDate);
    setHeavyDate(entry.heavyDate ?? '');
    setLastDate(entry.lastDate ?? '');
    setFlow(entry.flow ?? 'medium');
    setSymptoms(entry.symptoms ?? []);
    setNotes(entry.notes ?? '');
  }

  function toggleSymptom(value: Symptom) {
    setSymptoms((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function resetForm(nextStart = todayISO()) {
    setStartDate(nextStart);
    setHeavyDate('');
    setLastDate('');
    setFlow('medium');
    setSymptoms([]);
    setNotes('');
  }

  async function deleteCycle(id: string) {
    Alert.alert('Delete cycle?', 'This removes the local cycle log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await persist(cycles.filter((cycle) => cycle.id !== id));
        },
      },
    ]);
  }

  async function saveCycle() {
    if (!isISODate(startDate)) return Alert.alert('Invalid date', 'Start must be YYYY-MM-DD.');
    if (heavyDate && !isISODate(heavyDate)) return Alert.alert('Invalid date', 'Heaviest day must be YYYY-MM-DD.');
    if (lastDate && !isISODate(lastDate)) return Alert.alert('Invalid date', 'Last day must be YYYY-MM-DD.');
    if (lastDate && toDate(lastDate) < toDate(startDate)) return Alert.alert('Check dates', 'Last day cannot be before start.');
    if (heavyDate && toDate(heavyDate) < toDate(startDate)) return Alert.alert('Check dates', 'Heaviest day cannot be before start.');

    setSaving(true);
    try {
      const entry: Cycle = {
        id: startDate,
        startDate,
        heavyDate: heavyDate || undefined,
        lastDate: lastDate || undefined,
        flow,
        symptoms,
        notes: notes.trim() || undefined,
      };

      const index = cycles.findIndex((cycle) => cycle.id === entry.id);
      const next = [...cycles];
      if (index >= 0) next[index] = entry;
      else next.push(entry);

      await persist(next);
      resetForm(addDays(startDate, 28));
    } catch (e) {
      console.warn('save cycle failed', e);
      Alert.alert('Error', 'Could not save the cycle.');
    } finally {
      setSaving(false);
    }
  }

  const { avgCycle, avgPeriod, avgHeavyOffset } = useMemo(() => {
    if (!cycles.length) return { avgCycle: 28, avgPeriod: 5, avgHeavyOffset: 2 };

    const starts = cycles.map((cycle) => cycle.startDate).filter(isISODate).sort();
    const cycleDiffs: number[] = [];
    for (let i = 1; i < starts.length; i += 1) {
      const diff = daysBetween(starts[i - 1], starts[i]);
      if (diff > 10 && diff < 100) cycleDiffs.push(diff);
    }

    const periodLengths = cycles
      .filter((cycle) => cycle.startDate && cycle.lastDate)
      .map((cycle) => Math.max(1, daysBetween(cycle.startDate, cycle.lastDate!) + 1))
      .filter((days) => days > 0 && days <= 14);

    const heavyOffsets = cycles
      .filter((cycle) => cycle.startDate && cycle.heavyDate)
      .map((cycle) => Math.max(0, daysBetween(cycle.startDate, cycle.heavyDate!)))
      .filter((days) => days >= 0 && days <= 10);

    return {
      avgCycle: Math.round(cycleDiffs.length ? cycleDiffs.reduce((a, b) => a + b, 0) / cycleDiffs.length : 28),
      avgPeriod: Math.round(periodLengths.length ? periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length : 5),
      avgHeavyOffset: Math.round(heavyOffsets.length ? heavyOffsets.reduce((a, b) => a + b, 0) / heavyOffsets.length : 2),
    };
  }, [cycles]);

  const latestCycle = cycles[0];
  const nextStart = latestCycle ? addDays(latestCycle.startDate, avgCycle) : undefined;
  const today = todayISO();
  const daysToNext = nextStart ? daysBetween(today, nextStart) : undefined;
  const currentDay = latestCycle ? daysBetween(latestCycle.startDate, today) + 1 : undefined;
  const currentPeriodActive =
    !!latestCycle && !!latestCycle.lastDate && today >= latestCycle.startDate && today <= latestCycle.lastDate;

  const goToWearables = () => {
    try {
      navigation.navigate('Health', { screen: 'Wearables' });
    } catch {
      navigation.navigate('Wearables');
    }
  };

  return (
    <SafeLayout style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.flex}
        keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Health</Text>
            <Text style={styles.title}>Cycle tracker</Text>
            <Text style={styles.subtitle}>Log period days, track symptoms, and keep prediction history in one place.</Text>
          </View>

          {nextStart ? (
            <CycleSummaryCard
              cycleLength={avgCycle}
              periodLength={avgPeriod}
              heavyOffset={avgHeavyOffset}
              nextStart={nextStart}
            />
          ) : (
            <View style={styles.emptySummary}>
              <Text style={styles.emptyTitle}>Start with your latest period</Text>
              <Text style={styles.emptyText}>Add one cycle to unlock next-period predictions and trend stats.</Text>
            </View>
          )}

          <View style={styles.statusRow}>
            <StatusTile label="Today" value={currentPeriodActive ? 'Period day' : 'Tracking'} detail={currentDay ? `Cycle day ${Math.max(1, currentDay)}` : 'No cycle yet'} />
            <StatusTile label="Next" value={daysToNext === undefined ? '-' : daysToNext <= 0 ? 'Due now' : `${daysToNext}d`} detail={nextStart ? friendlyDate(nextStart) : 'Add a log'} />
          </View>

          <View style={styles.quickRow}>
            <Pressable style={styles.quickButton} onPress={() => setStartDate(todayISO())}>
              <Text style={styles.quickButtonText}>Period started today</Text>
            </Pressable>
            <Pressable
              style={styles.quickButton}
              onPress={() => {
                setHeavyDate(startDate);
                setFlow('heavy');
              }}
            >
              <Text style={styles.quickButtonText}>Mark heavy day</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={() => setLastDate(todayISO())}>
              <Text style={styles.quickButtonText}>Period ended today</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Log cycle</Text>
                <Text style={styles.cardSub}>Use YYYY-MM-DD for now; quick buttons fill common dates.</Text>
              </View>
              <Pressable style={styles.textButton} onPress={() => resetForm()}>
                <Text style={styles.textButtonText}>Clear</Text>
              </Pressable>
            </View>

            <DateField label="Start date" value={startDate} onChangeText={setStartDate} onToday={() => setStartDate(todayISO())} />
            <DateField
              label="Heaviest day"
              value={heavyDate}
              placeholder="Optional"
              onChangeText={setHeavyDate}
              onToday={() => setHeavyDate(todayISO())}
            />
            <DateField
              label="Last day"
              value={lastDate}
              placeholder="Optional"
              onChangeText={setLastDate}
              onToday={() => setLastDate(todayISO())}
            />

            <Text style={styles.label}>Flow</Text>
            <View style={styles.chipRow}>
              {FLOW_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.chip, flow === option.value && styles.chipActive]}
                  onPress={() => setFlow(option.value)}
                >
                  <Text style={[styles.chipText, flow === option.value && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Symptoms</Text>
            <View style={styles.chipRow}>
              {SYMPTOMS.map((option) => {
                const active = symptoms.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSymptom(option.value)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Pain, mood, medication, anything worth remembering..."
              multiline
              style={[styles.input, styles.notesInput]}
            />

            <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={saveCycle} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save cycle log'}</Text>
            </Pressable>
          </View>

          <View style={styles.metricsGrid}>
            <Metric label="Avg cycle" value={`${avgCycle}d`} />
            <Metric label="Avg period" value={`${avgPeriod}d`} />
            <Metric label="Heavy day" value={`Day ${avgHeavyOffset + 1}`} />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>History</Text>
                <Text style={styles.cardSub}>{cycles.length ? `${cycles.length} cycle${cycles.length === 1 ? '' : 's'} logged` : 'No cycle logs yet'}</Text>
              </View>
            </View>

            {cycles.length === 0 ? (
              <Text style={styles.muted}>Your saved logs will appear here.</Text>
            ) : (
              cycles.map((cycle) => (
                <View key={cycle.id} style={styles.historyRow}>
                  <Pressable style={styles.historyMain} onPress={() => loadCycle(cycle)}>
                    <Text style={styles.historyTitle}>{friendlyDate(cycle.startDate)}</Text>
                    <Text style={styles.historySub}>
                      {cycle.lastDate ? `${daysBetween(cycle.startDate, cycle.lastDate) + 1} days` : 'In progress'}
                      {cycle.heavyDate ? ` • heavy ${friendlyDate(cycle.heavyDate)}` : ''}
                    </Text>
                    {!!cycle.symptoms?.length && (
                      <Text style={styles.historyTags}>{cycle.symptoms.map((item) => item[0].toUpperCase() + item.slice(1)).join(', ')}</Text>
                    )}
                  </Pressable>
                  <Pressable style={styles.deleteButton} onPress={() => deleteCycle(cycle.id)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <Pressable onPress={goToWearables} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Wearables & Health Data</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeLayout>
  );
}

function DateField({
  label,
  value,
  placeholder = 'YYYY-MM-DD',
  onChangeText,
  onToday,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="numeric"
          style={styles.input}
        />
        <Pressable style={styles.todayButton} onPress={onToday}>
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatusTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.statusTile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileDetail}>{detail}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 12 },
  header: { marginBottom: 2 },
  eyebrow: { color: '#0A84FF', fontWeight: '800', marginBottom: 4 },
  title: { color: '#111827', fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#64748B', lineHeight: 20, marginTop: 6 },
  emptySummary: {
    borderWidth: 1,
    borderColor: '#D7E7F8',
    backgroundColor: '#F3F9FF',
    borderRadius: 12,
    padding: 16,
  },
  emptyTitle: { color: '#123B63', fontWeight: '900', fontSize: 17, marginBottom: 4 },
  emptyText: { color: '#345066', lineHeight: 20 },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  tileLabel: { color: '#64748B', fontWeight: '700', marginBottom: 4 },
  tileValue: { color: '#111827', fontWeight: '900', fontSize: 22 },
  tileDetail: { color: '#64748B', marginTop: 3 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickButton: {
    backgroundColor: '#EEF6FF',
    borderColor: '#CFE5FF',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickButtonText: { color: '#0A53B8', fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  cardSub: { color: '#64748B', marginTop: 3, maxWidth: 250 },
  textButton: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6 },
  textButtonText: { color: '#0A84FF', fontWeight: '800' },
  field: { marginBottom: 10 },
  label: { color: '#374151', fontSize: 13, fontWeight: '800', marginBottom: 6, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    color: '#111827',
  },
  notesInput: { minHeight: 84, textAlignVertical: 'top', marginBottom: 12 },
  todayButton: {
    borderRadius: 10,
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  todayButtonText: { color: '#0A84FF', fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#0A84FF', backgroundColor: '#E8F0FF' },
  chipText: { color: '#374151', fontWeight: '800' },
  chipTextActive: { color: '#0A84FF' },
  primaryButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  disabled: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metric: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  metricValue: { color: '#111827', fontWeight: '900', fontSize: 20 },
  metricLabel: { color: '#64748B', marginTop: 2, fontWeight: '700' },
  muted: { color: '#64748B' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 12,
    gap: 10,
  },
  historyMain: { flex: 1 },
  historyTitle: { color: '#111827', fontWeight: '900', fontSize: 16 },
  historySub: { color: '#64748B', marginTop: 2 },
  historyTags: { color: '#0A53B8', marginTop: 4, fontWeight: '700' },
  deleteButton: {
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: { color: '#B91C1C', fontWeight: '800' },
  secondaryButton: {
    alignSelf: 'center',
    backgroundColor: '#E8F0FF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  secondaryButtonText: { color: '#0A84FF', fontWeight: '900' },
});
