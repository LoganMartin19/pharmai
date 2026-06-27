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
import { useUser } from '../context/UserContext';

type Flow = 'light' | 'medium' | 'heavy';
type Symptom = 'cramps' | 'headache' | 'bloating' | 'mood' | 'fatigue' | 'tenderness';
type TrackCategory = 'flow' | 'feelings' | 'pain' | 'fertile' | 'pms';

type Cycle = {
  id: string;
  startDate: string;
  heavyDate?: string;
  lastDate?: string;
  flow?: Flow;
  trackingCategories?: TrackCategory[];
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
const TRACK_CATEGORIES: Array<{
  value: TrackCategory;
  title: string;
  detail: string;
  color: string;
  marker: string;
}> = [
  { value: 'flow', title: 'Period flow', detail: 'Start, end, and intensity', color: '#E63946', marker: '•' },
  { value: 'feelings', title: 'My feelings', detail: 'Mood and energy changes', color: '#F77F00', marker: '☺' },
  { value: 'pain', title: 'Cramps and pain', detail: 'Pain, headache, bloating', color: '#4676C7', marker: '↯' },
  { value: 'fertile', title: 'Fertile window', detail: 'Ovulation prediction', color: '#0096A6', marker: '◌' },
  { value: 'pms', title: 'PMS', detail: 'Patterns before your period', color: '#F4A261', marker: '☁' },
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

function longDate(s?: string) {
  if (!s) return '-';
  return toDate(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function sortCycles(rows: Cycle[]) {
  return [...rows].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export default function MenstrualTrackerScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const [startDate, setStartDate] = useState(todayISO());
  const [heavyDate, setHeavyDate] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [flow, setFlow] = useState<Flow>('medium');
  const [trackingCategories, setTrackingCategories] = useState<TrackCategory[]>([]);
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
    setTrackingCategories(entry.trackingCategories ?? []);
    setSymptoms(entry.symptoms ?? []);
    setNotes(entry.notes ?? '');
  }

  function toggleTrackCategory(value: TrackCategory) {
    setTrackingCategories((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
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
    setTrackingCategories([]);
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
        trackingCategories,
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
  const ovulationDate = latestCycle ? addDays(latestCycle.startDate, Math.max(1, avgCycle - 14)) : undefined;
  const fertileStart = ovulationDate ? addDays(ovulationDate, -5) : undefined;
  const fertileEnd = ovulationDate ? addDays(ovulationDate, 1) : undefined;
  const daysToOvulation = ovulationDate ? daysBetween(today, ovulationDate) : undefined;
  const currentDay = latestCycle ? daysBetween(latestCycle.startDate, today) + 1 : undefined;
  const currentPeriodActive =
    !!latestCycle && !!latestCycle.lastDate && today >= latestCycle.startDate && today <= latestCycle.lastDate;
  const fertileStatus =
    fertileStart && fertileEnd && today >= fertileStart && today <= fertileEnd
      ? 'High'
      : daysToOvulation !== undefined && daysToOvulation > 1 && daysToOvulation <= 7
      ? 'Soon'
      : 'Low';

  const goToWearables = () => {
    try {
      navigation.navigate('Health', { screen: 'Wearables' });
    } catch {
      navigation.navigate('Wearables');
    }
  };

  const goToSettings = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate('Settings');
    else navigation.navigate('Settings');
  };

  if (user?.gender !== 'female') {
    return (
      <SafeLayout style={styles.safe}>
        <View style={styles.lockedContent}>
          <Text style={styles.eyebrow}>Health</Text>
          <Text style={styles.title}>Cycle tracker</Text>
          <Text style={styles.subtitle}>
            Set Gender to Woman in Settings to use period, ovulation, and fertile-window tracking.
          </Text>
          <Pressable style={styles.primaryButton} onPress={goToSettings}>
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </Pressable>
        </View>
      </SafeLayout>
    );
  }

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
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroKicker}>{longDate(nextStart)}</Text>
                  <Text style={styles.heroTitle}>
                    {daysToNext === undefined
                      ? 'Track your cycle'
                      : daysToNext <= 0
                      ? 'Your period may start now'
                      : `${daysToNext} day${daysToNext === 1 ? '' : 's'} until your next period`}
                  </Text>
                  <Text style={styles.heroSub}>Based on your average {avgCycle}-day cycle</Text>
                </View>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeSmall}>Day</Text>
                  <Text style={styles.dayBadgeValue}>{currentDay ? Math.max(1, currentDay) : '-'}</Text>
                </View>
              </View>

              <View style={styles.cycleRing}>
                <View style={styles.ringTrack} />
                <View style={styles.ringPeriod} />
                <View style={styles.ringFertile} />
                <View style={styles.ringDot} />
                <Text style={styles.ringCenterLabel}>Today</Text>
                <Text style={styles.ringCenterValue}>
                  {currentPeriodActive ? 'Period day' : fertileStatus === 'High' ? 'Fertile window' : 'Tracking'}
                </Text>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Cycle {avgCycle}d</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Period {avgPeriod}d</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Heavy day {avgHeavyOffset + 1}</Text>
                </View>
              </View>
            </View>
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

          {latestCycle && ovulationDate && fertileStart && fertileEnd ? (
            <View style={styles.fertileCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fertileTitle}>Ovulation & fertile window</Text>
                <Text style={styles.fertileMain}>
                  {daysToOvulation === 0
                    ? 'Ovulation predicted today'
                    : daysToOvulation && daysToOvulation > 0
                    ? `Ovulation in ${daysToOvulation} day${daysToOvulation === 1 ? '' : 's'}`
                    : `Ovulation was around ${friendlyDate(ovulationDate)}`}
                </Text>
                <Text style={styles.fertileSub}>
                  Fertile window: {friendlyDate(fertileStart)} - {friendlyDate(fertileEnd)}
                </Text>
              </View>
              <View style={[styles.fertileBadge, fertileStatus === 'High' && styles.fertileBadgeHigh]}>
                <Text style={[styles.fertileBadgeText, fertileStatus === 'High' && styles.fertileBadgeTextHigh]}>
                  {fertileStatus}
                </Text>
              </View>
            </View>
          ) : null}

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

          <View style={styles.trackCard}>
            <Text style={styles.trackTitle}>What’s most important for you to track?</Text>
            <Text style={styles.trackSub}>Tap all that apply, then add details below.</Text>
            {TRACK_CATEGORIES.map((item) => {
              const active = trackingCategories.includes(item.value);
              return (
                <Pressable
                  key={item.value}
                  style={[styles.trackRow, active && styles.trackRowActive]}
                  onPress={() => toggleTrackCategory(item.value)}
                >
                  <View style={[styles.trackIcon, { backgroundColor: item.color }]}>
                    <Text style={styles.trackIconText}>{item.marker}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackRowTitle, active && styles.trackRowTitleActive]}>{item.title}</Text>
                    <Text style={styles.trackRowSub}>{item.detail}</Text>
                  </View>
                  <View style={[styles.trackCheck, active && styles.trackCheckActive]}>
                    <Text style={[styles.trackCheckText, active && styles.trackCheckTextActive]}>
                      {active ? '✓' : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
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
            <Metric label="Ovulation" value={daysToOvulation === undefined ? '-' : daysToOvulation <= 0 ? 'Now' : `${daysToOvulation}d`} />
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
                    {!!cycle.trackingCategories?.length && (
                      <Text style={styles.historyTags}>
                        {cycle.trackingCategories
                          .map((value) => TRACK_CATEGORIES.find((item) => item.value === value)?.title)
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
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
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 12, backgroundColor: '#FFF8F8' },
  lockedContent: { flex: 1, paddingHorizontal: 16, paddingTop: 24, gap: 14 },
  header: { marginBottom: 2 },
  eyebrow: { color: '#C91F37', fontWeight: '800', marginBottom: 4 },
  title: { color: '#111827', fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#64748B', lineHeight: 20, marginTop: 6 },
  heroCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F8D9D9',
    shadowColor: '#B42318',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  heroKicker: { color: '#7A5A5A', fontWeight: '800', marginBottom: 6 },
  heroTitle: { color: '#2B1B1B', fontSize: 25, fontWeight: '900', lineHeight: 30, maxWidth: 270 },
  heroSub: { color: '#6B7280', marginTop: 8, fontWeight: '600' },
  dayBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeSmall: { color: '#6B7280', fontSize: 11, fontWeight: '800' },
  dayBadgeValue: { color: '#111827', fontSize: 18, fontWeight: '900' },
  cycleRing: {
    alignSelf: 'center',
    width: 214,
    height: 214,
    borderRadius: 107,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  ringTrack: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 99,
    borderWidth: 18,
    borderColor: '#EFE7E5',
  },
  ringPeriod: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 99,
    borderWidth: 18,
    borderTopColor: '#C70025',
    borderRightColor: '#F25F5C',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '-38deg' }],
  },
  ringFertile: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 99,
    borderWidth: 18,
    borderTopColor: 'transparent',
    borderRightColor: '#0096A6',
    borderBottomColor: '#0096A6',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '26deg' }],
  },
  ringDot: {
    position: 'absolute',
    bottom: 28,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#72D2DF',
    borderWidth: 4,
    borderColor: '#0096A6',
  },
  ringCenterLabel: { color: '#7A5A5A', fontWeight: '800', marginBottom: 4 },
  ringCenterValue: { color: '#111827', fontWeight: '900', fontSize: 19, textAlign: 'center', maxWidth: 150 },
  heroFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  heroPill: { backgroundColor: '#C91F37', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  heroPillText: { color: '#fff', fontWeight: '900' },
  emptySummary: {
    borderWidth: 1,
    borderColor: '#F8D9D9',
    backgroundColor: '#FFFDFC',
    borderRadius: 20,
    padding: 16,
  },
  emptyTitle: { color: '#7F1D1D', fontWeight: '900', fontSize: 17, marginBottom: 4 },
  emptyText: { color: '#6B4E4E', lineHeight: 20 },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F3D0D0',
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#fff',
  },
  tileLabel: { color: '#64748B', fontWeight: '700', marginBottom: 4 },
  tileValue: { color: '#111827', fontWeight: '900', fontSize: 22 },
  tileDetail: { color: '#64748B', marginTop: 3 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fertileCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BDECEF',
    backgroundColor: '#F0FCFD',
    borderRadius: 20,
    padding: 14,
  },
  fertileTitle: { color: '#007C89', fontWeight: '900', marginBottom: 4 },
  fertileMain: { color: '#111827', fontWeight: '900', fontSize: 17 },
  fertileSub: { color: '#64748B', marginTop: 3 },
  fertileBadge: {
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fertileBadgeHigh: { backgroundColor: '#0096A6' },
  fertileBadgeText: { color: '#007C89', fontWeight: '900' },
  fertileBadgeTextHigh: { color: '#fff' },
  quickButton: {
    backgroundColor: '#FFF',
    borderColor: '#F3D0D0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickButtonText: { color: '#C91F37', fontWeight: '800' },
  trackCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F8D9D9',
  },
  trackTitle: { color: '#2B1B1B', fontSize: 21, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  trackSub: { color: '#7A5A5A', textAlign: 'center', marginBottom: 14, fontWeight: '600' },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF8F7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trackRowActive: {
    backgroundColor: '#FFF0F2',
    borderColor: '#C91F37',
  },
  trackIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIconText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  trackRowTitle: { color: '#007C89', fontWeight: '900', fontSize: 15 },
  trackRowTitleActive: { color: '#C91F37' },
  trackRowSub: { color: '#7A5A5A', marginTop: 2 },
  trackCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  trackCheckActive: {
    backgroundColor: '#C91F37',
    borderColor: '#C91F37',
  },
  trackCheckText: { color: '#fff', fontWeight: '900' },
  trackCheckTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3D0D0',
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
    backgroundColor: '#FFF0F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  todayButtonText: { color: '#C91F37', fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#C91F37', backgroundColor: '#FFF0F2' },
  chipText: { color: '#374151', fontWeight: '800' },
  chipTextActive: { color: '#C91F37' },
  primaryButton: {
    backgroundColor: '#C91F37',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  disabled: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metric: {
    flex: 1,
    backgroundColor: '#FFFDFC',
    borderWidth: 1,
    borderColor: '#F3D0D0',
    borderRadius: 18,
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
  historyTags: { color: '#007C89', marginTop: 4, fontWeight: '700' },
  deleteButton: {
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: { color: '#B91C1C', fontWeight: '800' },
  secondaryButton: {
    alignSelf: 'center',
    backgroundColor: '#FFF0F2',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  secondaryButtonText: { color: '#C91F37', fontWeight: '900' },
});
