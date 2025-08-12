// src/components/PillLookPicker.tsx
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import PillBadge from './PillBadge';
import type { PillStyle } from '../types/PillStyle';

type Props = {
  visible: boolean;
  initial?: PillStyle;
  onCancel: () => void;
  onDone: (style: PillStyle) => void;
};

const SHAPES: PillStyle['shape'][] = [
  'capsule',
  'round',
  'oval',
  'rectangle',
  'diamond',
  'triangle',
  'drop',
  'bottle',
  'jar',
  'spoon',
  'tube',
];

const COLORS = [
  '#2F80ED', '#34C759', '#FF3B30', '#FF9F0A', '#5856D6',
  '#FFCC00', '#5AC8FA', '#A2845E', '#A0AEC0', '#8E8E93',
];

export default function PillLookPicker({
  visible,
  initial,
  onCancel,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [shape, setShape] = useState<PillStyle['shape']>(initial?.shape ?? 'capsule');
  const [color, setColor] = useState<string>(initial?.color ?? '#2F80ED');

  const preview: PillStyle = useMemo(() => ({ shape, color }), [shape, color]);

  const next = () => setStep(2);
  const back = () => (step === 2 ? setStep(1) : onCancel());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onCancel}
    >
      <SafeAreaView
        style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={back}>
            <Text style={styles.headerAction}>{step === 1 ? 'Cancel' : 'Back'}</Text>
          </Pressable>

          <Text style={styles.title}>
            {step === 1 ? 'Choose the Shape' : 'Choose the Color'}
          </Text>

          {step === 1 ? (
            <Pressable hitSlop={8} onPress={next}>
              <Text style={styles.headerAction}>Next</Text>
            </Pressable>
          ) : (
            <Pressable hitSlop={8} onPress={() => onDone(preview)}>
              <Text style={styles.headerAction}>Done</Text>
            </Pressable>
          )}
        </View>

        {/* Preview */}
        <View style={styles.previewRow}>
          <PillBadge style={preview} size={46} />
        </View>

        {/* Grid */}
        <ScrollView
          contentContainerStyle={styles.gridScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <View style={styles.grid}>
              {SHAPES.map((s) => {
                const selected = s === shape;
                return (
                  <Pressable key={s} onPress={() => setShape(s)} style={styles.cell}>
                    <View style={[styles.badgeWrap, selected && styles.badgeWrapSelected]}>
                      <PillBadge style={{ shape: s, color }} size={24} />
                    </View>
                    <Text style={styles.cellLabel}>{cap(s)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.colors}>
              {COLORS.map((c) => {
                const selected = c === color;
                return (
                  <Pressable key={c} onPress={() => setColor(c)} style={styles.colorDotWrap}>
                    <View style={[styles.colorDot, { backgroundColor: c }]} />
                    {selected && <View style={styles.colorDotRing} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },

  previewRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  gridScroll: { paddingHorizontal: 12, paddingBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    marginTop: 8,
  },
  cell: { width: '23%', alignItems: 'center', gap: 6 },
  badgeWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF3FF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  badgeWrapSelected: { borderColor: '#007AFF', backgroundColor: '#E8F0FF' },
  cellLabel: { fontSize: 12, color: '#4A5568', textAlign: 'center' },

  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  colorDotWrap: { width: '18%', alignItems: 'center', paddingVertical: 8 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorDotRing: {
    position: 'absolute', width: 42, height: 42, borderRadius: 21,
    borderWidth: 2, borderColor: '#007AFF',
  },
});