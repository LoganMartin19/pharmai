// src/components/CycleSummaryCard.tsx
import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  nextStart: string;       // YYYY-MM-DD (required)
  periodLength: number;    // e.g., 5
  heavyOffset: number;     // e.g., 2
  cycleLength: number;     // e.g., 28
};

function daysUntil(dateISO: string) {
  const today = new Date();
  const target = new Date(dateISO + 'T00:00:00');
  const diff = Math.ceil((+target - +new Date(today.toDateString())) / 86400000);
  return diff;
}

export default function CycleSummaryCard({
  nextStart,
  periodLength,
  heavyOffset,
  cycleLength,
}: Props) {
  const inDays = daysUntil(nextStart);

  // Ring is purely decorative here (no heavy math) — soft, legible.
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 16,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
        Cycle overview
      </Text>

      {/* Decorative ring */}
      <View
        style={{
          width: 180,
          height: 180,
          borderRadius: 90,
          borderWidth: 14,
          borderColor: '#e6eefc',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            borderRightColor: '#0A84FF',
            borderTopColor: '#0A84FF',
            borderLeftColor: 'transparent',
            borderBottomColor: 'transparent',
            borderWidth: 14,
            transform: [{ rotate: '35deg' }],
            opacity: 0.15,
          }}
        />
        <Text style={{ fontSize: 13, color: '#475467', marginBottom: 2 }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800' }}>
          {inDays > 0 ? `${inDays} day${inDays === 1 ? '' : 's'}` : 'Today'}
        </Text>
        <Text style={{ color: '#0A84FF', fontWeight: '700' }}>
          until next period
        </Text>
      </View>

      {/* Chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Chip label={`Next: ${nextStart}`} />
        <Chip label={`Cycle ≈ ${cycleLength}d`} />
        <Chip label={`Period ≈ ${periodLength}d`} />
        <Chip label={`Heaviest ≈ day ${heavyOffset}`} />
      </View>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: '#EFF4FF',
        borderColor: '#D1E0FF',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: '#0A84FF', fontWeight: '700' }}>{label}</Text>
    </View>
  );
}