// src/components/PillBadge.tsx
import React from 'react';
import { View } from 'react-native';
import type { PillStyle } from '../types/PillStyle';

type Props = { style?: PillStyle; size?: number };

export default function PillBadge({ style, size = 20 }: Props) {
  const c = style?.color ?? '#2F80ED';
  const b = style?.borderColor ?? 'rgba(0,0,0,0.12)';

  const base: any = {
    width: size * 1.6,
    height: size,
    backgroundColor: c,
    borderColor: b,
    borderWidth: 1,
  };

  const shape = style?.shape ?? 'round';

  const shapeStyle: any =
    shape === 'capsule'
      ? { borderRadius: size / 2 }
      : shape === 'round'
      ? { width: size, height: size, borderRadius: size / 2 }
      : shape === 'oval'
      ? { borderRadius: size * 0.45 }
      : shape === 'rectangle'
      ? { borderRadius: 6 }
      : shape === 'diamond'
      ? {
          transform: [{ rotate: '45deg' }],
          width: size * 1.2,
          height: size * 1.2,
          borderRadius: 4,
        }
      : shape === 'triangle'
      ? {
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderLeftWidth: size * 0.8,
          borderRightWidth: size * 0.8,
          borderBottomWidth: size * 1.3,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: c,
          borderWidth: 0,
        }
      : shape === 'drop'
      ? {
          width: size,
          height: size * 1.4,
          borderRadius: size,
          transform: [{ rotate: '45deg' }],
        }
      : // bottles/containers: simple rounded square
        { width: size, height: size, borderRadius: 8 };

  if (shape === 'triangle') {
    return <View style={shapeStyle} />;
  }

  return <View style={[base, shapeStyle]} />;
}