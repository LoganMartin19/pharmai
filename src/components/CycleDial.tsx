// src/components/CycleDial.tsx
import React, { useMemo } from 'react';
import { View } from 'react-native';

type Props = {
  cycleLength: number;   // default 28
  periodLength: number;  // default 5
  heavyOffset: number;   // default 2
  // reference start date (YYYY-MM-DD) for the UPCOMING cycle
  nextStart: string;
};

function toDate(s: string){ return new Date(`${s}T00:00:00`); }
function daysBetween(a: string, b: string){ return Math.round((toDate(b).getTime()-toDate(a).getTime())/86400000); }
function addDays(s: string, n: number) { const d=toDate(s); d.setDate(d.getDate()+n); return d; }

export default function CycleDial({ cycleLength, periodLength, heavyOffset, nextStart }: Props) {
  // 28 spokes around a circle
  const ticks = 28;
  const size = 180;
  const r = size/2 - 8;

  // compute indices to color
  const heavyIndex = Math.min(ticks-1, Math.max(0, Math.round((heavyOffset / cycleLength) * ticks)));
  const periodEndIndex = Math.min(ticks-1, Math.max(0, Math.round(((heavyOffset + (periodLength-1)) / cycleLength) * ticks)));

  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginVertical: 8 }}>
      <View style={{
        position:'absolute', left:0, top:0, right:0, bottom:0,
        borderRadius: size/2, backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb'
      }}/>
      {Array.from({length: ticks}).map((_, i) => {
        const angle = (i / ticks) * 360;
        // highlight from 0..periodEndIndex as "period", mark heavyIndex darker
        const isPeriod = i >= 0 && i <= periodEndIndex;
        const isHeavy = i === heavyIndex;
        const color = isHeavy ? '#e11d48' : isPeriod ? '#fecaca' : '#e5e7eb';
        return (
          <View
            key={i}
            style={{
              position:'absolute',
              left: size/2-2,
              top: size/2 - r,
              width: 4,
              height: 16,
              backgroundColor: color,
              borderRadius: 2,
              transform: [
                { rotate: `${angle}deg` },
                { translateY: -4 },
              ],
            }}
          />
        );
      })}
      {/* center dot */}
      <View style={{
        position:'absolute', left:size/2-6, top:size/2-6, width:12, height:12, borderRadius:6, backgroundColor:'#0A84FF'
      }}/>
    </View>
  );
}