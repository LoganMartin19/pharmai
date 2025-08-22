// src/components/HomeHealthHeader.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'menstrual:cycles';

type Cycle = { startDate: string; heavyDate?: string; lastDate?: string };

function toDate(s: string) { return new Date(`${s}T00:00:00`); }
function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}
function addDays(s: string, n: number) {
  const d = toDate(s); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function HomeHealthHeader({ onOpen }: { onOpen?: () => void }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setCycles(raw ? JSON.parse(raw) : []);
      } catch {}
    })();
  }, []);

  const nextStart = useMemo(() => {
    if (!cycles.length) return null;
    const sorted = [...cycles].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
    const latest = sorted[0];

    // derive avg cycle length from history (fallback 28)
    const starts = sorted.map(c => c.startDate).sort();
    const diffs: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      const d = daysBetween(starts[i - 1], starts[i]);
      if (d > 0 && d < 100) diffs.push(d);
    }
    const avgCycle = Math.round(diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 28);

    return addDays(latest.startDate, avgCycle);
  }, [cycles]);

  if (!nextStart) return null;

  const handleOpen = () => {
    // Let parent decide how to navigate (simplest: navigation.navigate('Health'))
    onOpen?.();
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#FFF4F5',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#fee2e2',
      }}
    >
      <Text style={{ fontWeight: '700' }}>🩸 Menstrual</Text>
      <Text style={{ marginTop: 4 }}>
        Next period expected: <Text style={{ fontWeight: '700' }}>{nextStart}</Text>
      </Text>
      <Text style={{ color: '#e11d48', fontWeight: '700', marginTop: 6 }}>
        Open tracker →
      </Text>
    </Pressable>
  );
}