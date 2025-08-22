// src/screens/MenstrualTrackerScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import SafeLayout from '../components/SafeLayout';
import CycleSummaryCard from '../components/CycleSummaryCard';

type Cycle = {
  id: string;
  startDate: string;     // YYYY-MM-DD
  heavyDate?: string;
  lastDate?: string;
  notes?: string;
};

const STORAGE_KEY = 'menstrual:cycles';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function isISODate(s?: string) { return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function toDate(s: string) { return new Date(`${s}T00:00:00`); }
function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}
function addDays(s: string, n: number) {
  const d = toDate(s); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function MenstrualTrackerScreen() {
  const navigation = useNavigation<any>();

  const [startDate, setStartDate] = useState('');
  const [heavyDate, setHeavyDate] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const arr: Cycle[] = raw ? JSON.parse(raw) : [];
        arr.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
        setCycles(arr);
      } catch (e) { console.warn('load cycles failed', e); }
    })();
  }, []);

  async function persist(next: Cycle[]) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCycles(next.sort((a, b) => (a.startDate < b.startDate ? 1 : -1)));
  }

  async function saveCycle() {
    if (!isISODate(startDate)) return Alert.alert('Invalid date', 'Start must be YYYY-MM-DD.');
    if (heavyDate && !isISODate(heavyDate)) return Alert.alert('Invalid date', 'Heaviest must be YYYY-MM-DD.');
    if (lastDate && !isISODate(lastDate)) return Alert.alert('Invalid date', 'Last must be YYYY-MM-DD.');
    if (lastDate && toDate(lastDate) < toDate(startDate)) return Alert.alert('Check dates', 'Last cannot be before Start.');
    if (heavyDate && toDate(heavyDate) < toDate(startDate)) return Alert.alert('Check dates', 'Heaviest cannot be before Start.');

    setSaving(true);
    try {
      const id = startDate;
      const entry: Cycle = { id, startDate, heavyDate: heavyDate || undefined, lastDate: lastDate || undefined };
      const i = cycles.findIndex(c => c.id === id);
      const next = [...cycles];
      if (i >= 0) next[i] = entry; else next.push(entry);
      await persist(next);
      Alert.alert('Saved', 'Cycle saved locally.');
      setHeavyDate(''); setLastDate('');
    } catch (e) {
      console.warn('save cycle failed', e);
      Alert.alert('Error', 'Could not save the cycle.');
    } finally { setSaving(false); }
  }

  // ---------- stats & prediction ----------
  const { avgCycle, avgPeriod, avgHeavyOffset } = useMemo(() => {
    if (!cycles.length) return { avgCycle: 28, avgPeriod: 5, avgHeavyOffset: 2 };

    const starts = [...cycles].map(c => c.startDate).filter(isISODate).sort();
    const cycleDiffs: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      const d = daysBetween(starts[i - 1], starts[i]); if (d > 0 && d < 100) cycleDiffs.push(d);
    }
    const avgCycle = Math.round(cycleDiffs.length
      ? cycleDiffs.reduce((a, b) => a + b, 0) / cycleDiffs.length
      : 28);

    const periodLens = cycles
      .filter(c => c.startDate && c.lastDate)
      .map(c => Math.max(1, daysBetween(c.startDate, c.lastDate!) + 1))
      .filter(n => n > 0 && n <= 14);
    const avgPeriod = Math.round(periodLens.length
      ? periodLens.reduce((a, b) => a + b, 0) / periodLens.length
      : 5);

    const heavyOffsets = cycles
      .filter(c => c.startDate && c.heavyDate)
      .map(c => Math.max(0, daysBetween(c.startDate, c.heavyDate!)))
      .filter(n => n >= 0 && n <= 10);
    const avgHeavyOffset = Math.round(heavyOffsets.length
      ? heavyOffsets.reduce((a, b) => a + b, 0) / heavyOffsets.length
      : 2);

    return { avgCycle, avgPeriod, avgHeavyOffset };
  }, [cycles]);

  const nextStart = useMemo(() => {
    if (!cycles.length) return undefined;
    const newest = [...cycles].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
    return addDays(newest.startDate, avgCycle);
  }, [cycles, avgCycle]);

  // helper to navigate to Wearables whether nested (Health tab) or direct
  const goToWearables = () => {
    try {
      // nested: Health tab -> Wearables
      navigation.navigate('Health', { screen: 'Wearables' });
    } catch {
      // direct: if Wearables is on the same stack
      navigation.navigate('Wearables');
    }
  };

  // ---------- UI ----------
  return (
    <SafeLayout>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Menstrual Tracker</Text>

          {/* Summary card */}
        {nextStart && (
        <View style={{ marginBottom: 16 }}>
            <CycleSummaryCard
            cycleLength={avgCycle}
            periodLength={avgPeriod}
            heavyOffset={avgHeavyOffset}
            nextStart={nextStart}
            />
        </View>
        )}

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log current cycle</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Start (YYYY‑MM‑DD)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  inputMode="numeric"
                  style={styles.input}
                />
                <Pressable style={styles.smallBtn} onPress={() => setStartDate(todayISO())}>
                  <Text style={styles.smallBtnText}>Today</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Heaviest day</Text>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="YYYY-MM-DD (optional)"
                  value={heavyDate}
                  onChangeText={setHeavyDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  inputMode="numeric"
                  style={styles.input}
                />
                <Pressable
                  style={styles.smallBtn}
                  onPress={() => {
                    if (isISODate(startDate)) setHeavyDate(addDays(startDate, 2));
                    else Alert.alert('Set Start first', 'Enter a Start date to auto‑suggest heavy day.');
                  }}
                >
                  <Text style={styles.smallBtnText}>Suggest</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Last day</Text>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="YYYY-MM-DD (optional)"
                  value={lastDate}
                  onChangeText={setLastDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  inputMode="numeric"
                  style={styles.input}
                />
                <Pressable
                  style={styles.smallBtn}
                  onPress={() => {
                    if (isISODate(startDate)) setLastDate(addDays(startDate, 4));
                    else Alert.alert('Set Start first', 'Enter a Start date to auto‑suggest last day.');
                  }}
                >
                  <Text style={styles.smallBtnText}>Suggest</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={saveCycle} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save cycle'}</Text>
            </Pressable>
          </View>

          {/* Stats / History */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stats</Text>
            <Text style={styles.stat}>Avg cycle length: <Text style={styles.bold}>{avgCycle} days</Text></Text>
            <Text style={styles.stat}>Avg period length: <Text style={styles.bold}>{avgPeriod} days</Text></Text>
            <Text style={styles.stat}>Avg heavy offset: <Text style={styles.bold}>day {avgHeavyOffset}</Text></Text>
          </View>

          <View style={[styles.card, { paddingBottom: 4 }]}>
            <Text style={styles.cardTitle}>History</Text>
            {cycles.length === 0 ? (
              <Text style={styles.muted}>No cycles logged yet.</Text>
            ) : (
              <FlatList
                data={cycles}
                keyExtractor={(c) => c.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.cycleRow}>
                    <Text style={styles.bold}>{item.startDate}</Text>
                    <Text style={styles.small}>
                      {item.heavyDate ? ` heavy: ${item.heavyDate}` : ' heavy: —'}
                      {item.lastDate ? ` • last: ${item.lastDate}` : ' • last: —'}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>

          {/* CTA → Wearables screen */}
          <Pressable onPress={goToWearables} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Wearables & Health Data →</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },

  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontWeight: '700', marginBottom: 10, fontSize: 16 },

  row: { marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff',
  },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#E8F0FF', borderRadius: 8 },
  smallBtnText: { color: '#0A84FF', fontWeight: '700' },
  primaryBtn: { marginTop: 4, backgroundColor: '#0A84FF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  muted: { color: '#777' },
  stat: { marginBottom: 4, color: '#222' },
  bold: { fontWeight: '700' },
  cycleRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eef2f7' },
  small: { fontSize: 12, color: '#555' },

  secondaryBtn: {
    marginTop: 6,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#E8F0FF',
  },
  secondaryBtnText: { color: '#0A84FF', fontWeight: '700' },
});