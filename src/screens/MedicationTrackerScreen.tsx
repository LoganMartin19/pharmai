// src/screens/MedicationTrackerScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Medication } from '../types/Medication';
import styles from './styles/MedicationTrackerScreen.styles';

type MedicationTrackerRouteProp = RouteProp<RootStackParamList, 'MedicationTracker'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'MedicationTracker'>;

type DayStat = { date: string; taken: number; total: number; pct: number };

function toISO(d: Date) { return d.toISOString().split('T')[0]; }
function fromISO(s: string) { return new Date(`${s}T00:00:00`); }
function rangeDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    out.push(toISO(dt));
  }
  return out;
}

export default function MedicationTrackerScreen() {
  const route = useRoute<MedicationTrackerRouteProp>();
  const navigation = useNavigation<Nav>();
  const { medication } = route.params;

  const [tab, setTab] = useState<'overview' | 'analytics'>('overview');

  /* ---------------- Overview (your existing per‑day progress list) ---------------- */
  const getDateRange = (): string[] => {
    const start = medication.startDate ? new Date(medication.startDate) : new Date();
    const end = medication.endDate ? new Date(medication.endDate) : new Date();

    const days: string[] = [];
    let current = new Date(start);
    // ensure chronological order start -> end
    while (current <= end) {
      days.push(toISO(current));
      current.setDate(current.getDate() + 1);
    }

    // If there’s no history window defined, at least show the last 7 days
    if (days.length === 0) return rangeDays(7);
    return days;
  };

  const getTakenStatus = (date: string) => {
    const entry = medication.history?.find((h) => h.date === date);
    if (!entry) return [];
    return Array.isArray(entry.taken) ? entry.taken : [entry.taken];
  };

  const days = getDateRange();

  /* ---------------- Analytics (per‑medication) ---------------- */
  const [windowKey, setWindowKey] = useState<'7' | '30' | 'all'>('7');

  const analyticsDays: string[] = useMemo(() => {
    if (windowKey !== 'all') return rangeDays(windowKey === '7' ? 7 : 30);
    const dates = (medication.history ?? []).map(h => h.date).sort();
    if (!dates.length) return rangeDays(7);
    const start = fromISO(dates[0]);
    const end = fromISO(dates[dates.length - 1]);
    const out: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(toISO(d));
    }
    return out;
  }, [windowKey, medication.history]);

  const stats: DayStat[] = useMemo(() => {
    return analyticsDays.map(d => {
      const rec = medication.history?.find(h => h.date === d);
      const total = rec?.taken?.length ?? 0;
      const taken = total ? rec!.taken.filter(Boolean).length : 0;
      const pct = total ? Math.round((taken / total) * 100) : 0;
      return { date: d, taken, total, pct };
    });
  }, [analyticsDays, medication.history]);

  const avg = useMemo(() => {
    const have = stats.filter(s => s.total > 0);
    if (!have.length) return 0;
    return Math.round(have.reduce((a, b) => a + b.pct, 0) / have.length);
  }, [stats]);

  const freq =
    medication.frequency === 'Twice daily' ? 2 :
    medication.frequency === 'Three times daily' ? 3 : 1;

  /* ---------------- Render ---------------- */
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{medication.name} Tracker</Text>
      <Text style={{ color: '#666', marginBottom: 10 }}>
        {medication.dosage ?? ''}{medication.time ? ` • ${medication.time}` : ''}{medication.frequency ? ` • ${medication.frequency}` : ''}
      </Text>

      {/* Segmented toggle */}
      <View style={local.tabRow}>
        {(['overview', 'analytics'] as const).map(k => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={[local.tabPill, tab === k && local.tabActive]}
          >
            <Text style={[local.tabText, tab === k && local.tabTextActive]}>
              {k === 'overview' ? 'Overview' : 'Analytics'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quick link to global analytics (optional) */}
      <Pressable
        onPress={() => navigation.navigate('AdherenceAnalytics' as never)}
        style={local.linkBtn}
      >
        <Text style={local.linkBtnText}>View overall analytics</Text>
      </Pressable>

      {tab === 'overview' ? (
        <>
          {days.map((dateStr, index) => {
            const date = new Date(dateStr);
            const dayLabel = date.toLocaleDateString('en-GB', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
            });

            const taken = getTakenStatus(dateStr);
            const totalDoses = freq;
            const takenCount = taken.filter((t) => t).length;

            const missed = taken.length === totalDoses && takenCount < totalDoses;
            const barFill = totalDoses ? takenCount / totalDoses : 0;

            return (
              <View key={index} style={styles.dayContainer}>
                <Text style={[styles.dayLabel, missed && styles.missed]}>{dayLabel}</Text>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { flex: barFill }]} />
                  <View style={{ flex: Math.max(0, 1 - barFill) }} />
                </View>

                <Text style={styles.progressText}>
                  {takenCount}/{totalDoses} doses taken
                </Text>
              </View>
            );
          })}
        </>
      ) : (
        <View style={{ marginTop: 10 }}>
          {/* Window selector */}
          <View style={local.row}>
            {(['7', '30', 'all'] as const).map(key => (
              <Pressable
                key={key}
                onPress={() => setWindowKey(key)}
                style={[local.pill, windowKey === key && local.pillActive]}
              >
                <Text style={[local.pillText, windowKey === key && local.pillTextActive]}>
                  {key === '7' ? 'Last 7 days' : key === '30' ? 'Last 30 days' : 'All history'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ marginTop: 8, marginBottom: 6, color: '#111', fontWeight: '700' }}>
            Average: {avg}% ({stats.length} days)
          </Text>

          {/* Tiny bar chart (no libs) */}
          <View style={local.chartWrap}>
            {stats.map((s, idx) => {
              const maxHeight = 120;
              const h = Math.round((s.pct / 100) * maxHeight);
              return (
                <View key={s.date + idx} style={local.barItem}>
                  <View style={[local.bar, { height: Math.max(2, h) }]} />
                  <Text style={local.barLabel}>{s.date.slice(5)}</Text>
                </View>
              );
            })}
          </View>

          {/* Recent 7‑day table */}
          <View style={{ marginTop: 12 }}>
            {stats.slice(-7).reverse().map(s => (
              <View key={s.date} style={local.rowLine}>
                <Text style={{ width: 90, color: '#555' }}>{s.date}</Text>
                <Text style={{ marginLeft: 6, fontWeight: '600' }}>{s.pct}%</Text>
                <Text style={{ marginLeft: 'auto', color: '#555' }}>
                  {s.taken}/{s.total} doses
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  /* tabs */
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabActive: { backgroundColor: '#E8F0FF', borderColor: '#0A84FF' },
  tabText: { color: '#333', fontWeight: '600' },
  tabTextActive: { color: '#0A84FF' },

  /* link button */
  linkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  linkBtnText: { color: '#0A84FF', fontWeight: '700' },

  /* analytics controls */
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#E8F0FF', borderColor: '#0A84FF' },
  pillText: { color: '#333', fontWeight: '600' },
  pillTextActive: { color: '#0A84FF' },

  /* chart */
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  barItem: { alignItems: 'center' },
  bar: { width: 14, backgroundColor: '#0A84FF', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 10, color: '#666', marginTop: 4 },

  /* list */
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
});