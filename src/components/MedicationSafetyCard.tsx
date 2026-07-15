import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Medication } from '../types/Medication';
import { getMedicationSafetyInfo } from '../utils/medicationSafety';
import { getNhsMedicineInformation, NhsMedicineInformation } from '../api/nhsContent';

type Props = {
  medication: Medication;
  showLocalSafety?: boolean;
};

export default function MedicationSafetyCard({ medication, showLocalSafety = true }: Props) {
  const info = getMedicationSafetyInfo(medication);
  const [nhsInfo, setNhsInfo] = useState<NhsMedicineInformation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showNhsInformation = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (nhsInfo || loading) return;
    setLoading(true);
    setError(null);
    try {
      setNhsInfo(await getNhsMedicineInformation(medication.nhsSlug || medication.name));
    } catch {
      setError('NHS information is not available for this medicine yet. Check the medicine leaflet or ask a pharmacist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {showLocalSafety && (
        <>
          <Text style={styles.title}>{info.title}</Text>
          {info.notes.map((note) => <Text key={note} style={styles.line}>- {note}</Text>)}
          <Text style={styles.subTitle}>Cautions</Text>
          {info.cautions.map((note) => <Text key={note} style={styles.line}>- {note}</Text>)}
          <Text style={styles.subTitle}>Ask a pharmacist if</Text>
          {info.askPharmacist.map((note) => <Text key={note} style={styles.line}>- {note}</Text>)}
        </>
      )}

      <Pressable accessibilityRole="button" onPress={showNhsInformation} style={styles.moreButton}>
        <Text style={styles.moreButtonText}>{expanded ? 'Hide NHS information' : 'More information from the NHS'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.nhsContent}>
          {loading && <ActivityIndicator color="#005EB8" />}
          {error && <Text style={styles.error}>{error}</Text>}
          {nhsInfo && (
            <>
              <Text style={styles.nhsTitle}>{nhsInfo.name}</Text>
              {!!nhsInfo.description && <Text style={styles.description}>{nhsInfo.description}</Text>}
              {nhsInfo.sections.map((section, index) => (
                <View key={`${section.title}-${index}`} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionText}>{section.text}</Text>
                </View>
              ))}
              {nhsInfo.sections.length === 0 && (
                <Text style={styles.error}>This NHS page does not contain modular medicine sections.</Text>
              )}
              {!!nhsInfo.sourceUrl && (
                <Pressable onPress={() => Linking.openURL(nhsInfo.sourceUrl!)}>
                  {!!nhsInfo.attributionLogo && (
                    <Image source={{ uri: nhsInfo.attributionLogo }} resizeMode="contain" style={styles.nhsLogo} />
                  )}
                  <Text style={styles.sourceLink}>View the original page on NHS.uk</Text>
                </Pressable>
              )}
              <Text style={styles.attribution}>Information supplied by the NHS website. Always read the leaflet provided with your medicine.</Text>
            </>
          )}
        </View>
      )}
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
  moreButton: { backgroundColor: '#005EB8', borderRadius: 8, padding: 11, marginTop: 14, alignItems: 'center' },
  moreButtonText: { color: '#fff', fontWeight: '800' },
  nhsContent: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#A9C7E5', marginTop: 14, paddingTop: 14 },
  nhsTitle: { color: '#003D78', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  description: { color: '#345066', lineHeight: 20, marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#123B63', fontWeight: '800', fontSize: 16, marginBottom: 5 },
  sectionText: { color: '#263F52', lineHeight: 21 },
  error: { color: '#7A3E00', lineHeight: 20 },
  sourceLink: { color: '#005EB8', fontWeight: '800', textDecorationLine: 'underline', marginTop: 4 },
  nhsLogo: { width: 170, height: 54, alignSelf: 'flex-start' },
  attribution: { color: '#4B6478', fontSize: 12, lineHeight: 17, marginTop: 10 },
});
