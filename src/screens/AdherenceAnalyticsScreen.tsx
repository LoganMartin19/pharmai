// src/screens/AdherenceAnalyticsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import SafeLayout from '../components/SafeLayout';
import { useReminders } from '../context/RemindersContext';
import type { Medication } from '../types/Medication';
import { Eyebrow } from '../components/Primitives';
import { colors, radius, shadow, spacing, type } from '../theme';

type DayStat = { date: string; taken: number; total: number; pct: number };
type MedStat = { id: string; name: string; taken: number; total: number; pct: number };

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
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

export default function AdherenceAnalyticsScreen() {
  const { reminders } = useReminders();
  const [windowKey, setWindowKey] = useState<'7' | '30' | 'all'>('7');

  // ---------- Build day list for the selected window ----------
  const days: string[] = useMemo(() => {
    if (windowKey !== 'all') return rangeDays(windowKey === '7' ? 7 : 30);
    // all history across all meds
    let min: string | null = null;
    let max: string | null = null;
    reminders.forEach(m =>
      m.history?.forEach(h => {
        if (!min || h.date < min) min = h.date;
        if (!max || h.date > max) max = h.date;
      })
    );
    if (!min || !max) return rangeDays(7);
    const out: string[] = [];
    for (let d = new Date(fromISO(min)); d <= fromISO(max); d.setDate(d.getDate() + 1)) {
      out.push(toISO(d));
    }
    return out;
  }, [windowKey, reminders]);

  // ---------- Overall per-day stats (aggregate across all meds) ----------
  const dayStats: DayStat[] = useMemo(() => {
    return days.map(d => {
      let taken = 0, total = 0;
      reminders.forEach((m: Medication) => {
        const rec = m.history?.find(h => h.date === d);
        if (rec?.taken) {
          total += rec.taken.length;
          rec.taken.forEach(v => v && taken++);
        }
      });
      const pct = total ? Math.round((taken / total) * 100) : 0;
      return { date: d, taken, total, pct };
    });
  }, [days, reminders]);

  const overallAvg = useMemo(() => {
    const have = dayStats.filter(s => s.total > 0);
    if (!have.length) return 0;
    return Math.round(have.reduce((a, b) => a + b.pct, 0) / have.length);
  }, [dayStats]);

  // ---------- Per‑medication aggregate stats within the window ----------
  const medStats: MedStat[] = useMemo(() => {
    return reminders.map(m => {
      let taken = 0, total = 0;
      const setDays = new Set(days);
      m.history?.forEach(h => {
        if (setDays.has(h.date) && h.taken?.length) {
          total += h.taken.length;
          h.taken.forEach(v => v && taken++);
        }
      });
      const pct = total ? Math.round((taken / total) * 100) : 0;
      return { id: m.id, name: m.name, taken, total, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [reminders, days]);

  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={s.content}>
        <Eyebrow>YOUR PROGRESS</Eyebrow>
        <Text style={s.title}>All‑medications adherence</Text>

        {/* Window selector */}
        <View style={s.row}>
          {(['7', '30', 'all'] as const).map(key => (
            <Pressable
              key={key}
              onPress={() => setWindowKey(key)}
              style={[s.pill, windowKey === key && s.pillActive]}
            >
              <Text style={[s.pillText, windowKey === key && s.pillTextActive]}>
                {key === '7' ? 'Last 7 days' : key === '30' ? 'Last 30 days' : 'All history'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Overall summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Overall average</Text>
          <Text style={s.summaryValue}>{overallAvg}%</Text>
          <Text style={s.summaryMeta}>Across {dayStats.length} days</Text>
        </View>

        {/* Overall daily bar chart */}
        <View style={s.chartWrap}>
          {dayStats.map((sday, idx) => {
            const maxHeight = 120;
            const h = Math.round((sday.pct / 100) * maxHeight);
            return (
              <View key={sday.date + idx} style={s.barItem}>
                <View style={[s.bar, { height: Math.max(2, h) }]} />
                <Text style={s.barLabel}>{sday.date.slice(5)}</Text>
              </View>
            );
          })}
        </View>

        {/* Per‑med summary grid */}
        <Text style={s.sectionTitle}>By medication</Text>
        <View style={s.grid}>
          {medStats.map(ms => (
            <View key={ms.id} style={s.tile}>
              <Text style={s.tileTitle} numberOfLines={1}>{ms.name}</Text>
              <Text style={s.tilePct}>{ms.pct}%</Text>
              <Text style={s.tileSub}>{ms.taken}/{ms.total} doses</Text>
            </View>
          ))}
        </View>

        {/* Per‑med last 7‑day detail rows (regardless of window, just to keep it compact) */}
        <View style={{ marginTop: 8 }}>
          {reminders.map((m) => {
            const recentDays = rangeDays(7);
            const rows = recentDays.map(d => {
              const rec = m.history?.find(h => h.date === d);
              const total = rec?.taken?.length ?? 0;
              const taken = total ? rec!.taken.filter(Boolean).length : 0;
              const pct = total ? Math.round((taken / total) * 100) : 0;
              return { date: d, taken, total, pct };
            }).reverse(); // newest top

            const medAvg = (() => {
              const valid = rows.filter(r => r.total > 0);
              if (!valid.length) return 0;
              return Math.round(valid.reduce((a, b) => a + b.pct, 0) / valid.length);
            })();

            return (
              <View key={m.id} style={s.medBlock}>
                <Text style={s.medBlockTitle}>{m.name} — last 7 days avg {medAvg}%</Text>
                {rows.map(r => (
                  <View key={m.id + r.date} style={s.rowLine}>
                    <Text style={s.dateText}>{r.date}</Text>
                    <Text style={s.percentText}>{r.pct}%</Text>
                    <Text style={s.doseText}>
                      {r.taken}/{r.total} doses
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeLayout>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  title: { ...type.title, color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  pillText: { color: colors.inkMuted, fontWeight: '600' },
  pillTextActive: { color: colors.brandDark },
  summaryCard: { marginTop: spacing.lg, backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.xl },
  summaryLabel: { ...type.label, color: '#B7CBC4' },
  summaryValue: { ...type.hero, color: colors.white, marginTop: spacing.xs },
  summaryMeta: { ...type.caption, color: '#B7CBC4', marginTop: spacing.xs },

  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.line },
  barItem: { alignItems: 'center' },
  bar: { width: 14, backgroundColor: colors.brand, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 10, color: colors.inkMuted, marginTop: 4 },
  sectionTitle: { ...type.heading, color: colors.ink, marginTop: spacing.lg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  tileTitle: { fontWeight: '700', marginBottom: 2, color: colors.ink },
  tilePct: { fontSize: 18, fontWeight: '800', color: colors.brand },
  tileSub: { color: colors.inkMuted, marginTop: 2 },

  medBlock: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  medBlockTitle: { fontWeight: '700', marginBottom: 6, color: colors.ink },
  rowLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line },
  dateText: { width: 90, color: colors.inkMuted },
  percentText: { marginLeft: 6, fontWeight: '700', color: colors.ink },
  doseText: { marginLeft: 'auto', color: colors.inkMuted },
});
