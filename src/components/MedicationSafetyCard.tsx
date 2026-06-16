import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Medication } from '../types/Medication';
import { getMedicationSafetyInfo } from '../utils/medicationSafety';

type Props = {
  medication: Medication;
};

export default function MedicationSafetyCard({ medication }: Props) {
  const info = getMedicationSafetyInfo(medication);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{info.title}</Text>
      {info.notes.map((note) => (
        <Text key={note} style={styles.line}>- {note}</Text>
      ))}

      <Text style={styles.subTitle}>Cautions</Text>
      {info.cautions.map((note) => (
        <Text key={note} style={styles.line}>- {note}</Text>
      ))}

      <Text style={styles.subTitle}>Ask a pharmacist if</Text>
      {info.askPharmacist.map((note) => (
        <Text key={note} style={styles.line}>- {note}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#D7E7F8',
    backgroundColor: '#F3F9FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#123B63', marginBottom: 8 },
  subTitle: { fontWeight: '800', color: '#123B63', marginTop: 10, marginBottom: 4 },
  line: { color: '#345066', lineHeight: 20, marginBottom: 3 },
});
