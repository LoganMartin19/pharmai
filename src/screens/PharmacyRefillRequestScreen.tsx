import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import SafeLayout from '../components/SafeLayout';
import { useReminders } from '../context/RemindersContext';
import { auth, db } from '../firebase';
import type { RootStackParamList } from '../navigation/MainNavigator';

type Route = RouteProp<RootStackParamList, 'PharmacyRefillRequest'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'PharmacyRefillRequest'>;

const WINDOWS = [30, 60] as const;

function formatAvailability(status?: string) {
  switch (status) {
    case 'available_now':
      return 'Available now';
    case 'usually_available':
      return 'Usually available';
    case 'order_by_tomorrow':
      return 'Order by tomorrow';
    case 'out_of_stock':
      return 'Out of stock';
    case 'call_to_confirm':
    default:
      return 'Call to confirm';
  }
}

export default function PharmacyRefillRequestScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { pharmacy } = route.params;
  const { reminders } = useReminders();

  const defaultMedId = route.params.medicationId ?? reminders[0]?.id;
  const [selectedMedId, setSelectedMedId] = useState(defaultMedId);
  const [windowMinutes, setWindowMinutes] = useState<number>(
    pharmacy.responseWindowMinutes && pharmacy.responseWindowMinutes <= 30 ? 30 : 60
  );
  const [note, setNote] = useState('');
  const [contact, setContact] = useState(auth.currentUser?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [sharePickup, setSharePickup] = useState(true);
  const [shareAdherence, setShareAdherence] = useState(false);

  const selectedMed = useMemo(
    () => reminders.find((med) => med.id === selectedMedId),
    [reminders, selectedMedId]
  );

  const submitRequest = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }
    if (!selectedMed) {
      Alert.alert('Choose medication', 'Select the prescription you want to request.');
      return;
    }
    if (!contact.trim()) {
      Alert.alert('Contact needed', 'Add an email or phone number so the pharmacy can respond.');
      return;
    }

    try {
      setSubmitting(true);
      const now = Date.now();
      const expiresAt = Timestamp.fromMillis(now + windowMinutes * 60 * 1000);

      await addDoc(collection(db, 'pharmacyRequests'), {
        userUid: user.uid,
        pharmacyPartnerId: pharmacy.partnerId ?? null,
        pharmacyOrgId: pharmacy.partnerOrgId ?? null,
        requestType: 'prescription_collection_enquiry',
        userEmail: user.email ?? null,
        contact: contact.trim(),
        status: 'pending',
        responseWindowMinutes: windowMinutes,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        note: note.trim() || null,
        medication: {
          id: selectedMed.id,
          name: selectedMed.name,
          dosage: selectedMed.dosage,
          frequency: selectedMed.frequency ?? null,
          time: selectedMed.time ?? null,
          endDate: selectedMed.endDate ?? null,
          repeatPrescription: !!selectedMed.repeatPrescription,
        },
        pharmacy: {
          id: pharmacy.id,
          name: pharmacy.name,
          address: pharmacy.address ?? null,
          latitude: pharmacy.latitude,
          longitude: pharmacy.longitude,
          distanceMiles: pharmacy.distanceMiles,
          sponsored: !!pharmacy.sponsored,
          partnerTier: pharmacy.partnerTier ?? null,
          partnerId: pharmacy.partnerId ?? null,
          availabilityStatus: pharmacy.availabilityStatus ?? null,
          acceptsRefillRequests: pharmacy.acceptsRefillRequests ?? null,
        },
      });

      if (pharmacy.partnerOrgId && (sharePickup || shareAdherence)) {
        const scopes = ['medicine_identity', 'service_messages'];
        if (sharePickup) scopes.push('pickup_confirmation');
        if (shareAdherence) scopes.push('adherence_summary');
        await addDoc(collection(db, 'patientPharmacyConsents'), {
          patientUid: user.uid,
          pharmacyOrgId: pharmacy.partnerOrgId,
          pharmacyPartnerId: pharmacy.partnerId ?? null,
          branchId: pharmacy.id,
          medicationId: selectedMed.id,
          scopes,
          active: true,
          purpose: 'prescription_collection_and_support',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
        });
      }

      Alert.alert(
        'Request sent',
        `${pharmacy.name} has ${windowMinutes} minutes to respond once their PharmAI inbox is active.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      console.warn('submit refill request failed', e);
      Alert.alert('Could not send request', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={styles.title}>Request refill</Text>
        <View style={styles.pharmacyCard}>
          <Text style={styles.pharmacyName}>{pharmacy.name}</Text>
          {pharmacy.address ? <Text style={styles.muted}>{pharmacy.address}</Text> : null}
          <Text style={styles.muted}>{pharmacy.distanceMiles.toFixed(1)} miles away</Text>
          <View style={styles.statusRow}>
            <View style={styles.availabilityBadge}>
              <Text style={styles.availabilityText}>{formatAvailability(pharmacy.availabilityStatus)}</Text>
            </View>
            {pharmacy.sponsored ? (
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredText}>Partner</Text>
              </View>
            ) : null}
          </View>
        </View>

        {!pharmacy.acceptsRefillRequests ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              This pharmacy is not yet confirmed as a PharmAI request partner. The request will be saved for the workflow, but live pharmacy response needs partner onboarding.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Medication</Text>
        {reminders.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Add a medication reminder before requesting a refill.</Text>
          </View>
        ) : (
          reminders.map((med) => (
            <Pressable
              key={med.id}
              style={[styles.medOption, selectedMedId === med.id && styles.medOptionSelected]}
              onPress={() => setSelectedMedId(med.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.muted}>{med.dosage}{med.endDate ? ` • ends ${med.endDate}` : ''}</Text>
              </View>
              <Text style={selectedMedId === med.id ? styles.selectedText : styles.unselectedText}>
                {selectedMedId === med.id ? 'Selected' : 'Choose'}
              </Text>
            </Pressable>
          ))
        )}

        <Text style={styles.label}>Response window</Text>
        <View style={styles.windowRow}>
          {WINDOWS.map((minutes) => (
            <Pressable
              key={minutes}
              style={[styles.windowButton, windowMinutes === minutes && styles.windowButtonSelected]}
              onPress={() => setWindowMinutes(minutes)}
            >
              <Text style={[styles.windowText, windowMinutes === minutes && styles.windowTextSelected]}>
                {minutes} min
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Contact</Text>
        <TextInput
          value={contact}
          onChangeText={setContact}
          placeholder="Email or phone"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything the pharmacy should know?"
          multiline
          style={[styles.input, styles.noteInput]}
        />

        {pharmacy.partnerOrgId ? (
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>Information sharing</Text>
            <Text style={styles.noticeText}>Choose what this pharmacy can see for this medicine. You can revoke access later.</Text>
            <Pressable style={styles.consentRow} onPress={() => setSharePickup((value) => !value)}>
              <Text style={styles.checkbox}>{sharePickup ? '✓' : ''}</Text>
              <View style={{ flex: 1 }}><Text style={styles.consentLabel}>Prescription pickup confirmation</Text><Text style={styles.muted}>Let this pharmacy record that you collected it.</Text></View>
            </Pressable>
            <Pressable style={styles.consentRow} onPress={() => setShareAdherence((value) => !value)}>
              <Text style={styles.checkbox}>{shareAdherence ? '✓' : ''}</Text>
              <View style={{ flex: 1 }}><Text style={styles.consentLabel}>30-day adherence summary</Text><Text style={styles.muted}>Optional. Shares a percentage only, never your dose-by-dose history.</Text></View>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={submitRequest}
          disabled={submitting || reminders.length === 0}
          style={[styles.primaryButton, (submitting || reminders.length === 0) && { opacity: 0.55 }]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send request</Text>}
        </Pressable>
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 14 },
  consentCard: { borderWidth: 1, borderColor: '#B7DDCF', backgroundColor: '#F0FAF6', borderRadius: 10, padding: 14, marginTop: 16 },
  consentTitle: { fontSize: 16, fontWeight: '800', color: '#145D46', marginBottom: 4 },
  consentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 13 },
  checkbox: { width: 23, height: 23, borderWidth: 1, borderColor: '#168D65', borderRadius: 5, textAlign: 'center', lineHeight: 21, color: '#168D65', fontWeight: '900' },
  consentLabel: { color: '#163D31', fontWeight: '800', marginBottom: 2 },
  pharmacyCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  pharmacyName: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  muted: { color: '#6B7280', marginTop: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  availabilityBadge: { borderRadius: 999, backgroundColor: '#E8F0FF', paddingHorizontal: 9, paddingVertical: 4 },
  availabilityText: { color: '#0A53B8', fontWeight: '800', fontSize: 12 },
  sponsoredBadge: { borderRadius: 999, backgroundColor: '#FDECC8', paddingHorizontal: 9, paddingVertical: 4 },
  sponsoredText: { color: '#7A4A00', fontWeight: '800', fontSize: 12 },
  notice: {
    borderWidth: 1,
    borderColor: '#F5D0A5',
    backgroundColor: '#FFF8ED',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: { color: '#7A4A00', lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '800', color: '#374151', marginTop: 14, marginBottom: 8 },
  medOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  medOptionSelected: { borderColor: '#0A84FF', backgroundColor: '#F1F7FF' },
  medName: { fontWeight: '800', color: '#111827', marginBottom: 2 },
  selectedText: { color: '#0A84FF', fontWeight: '800' },
  unselectedText: { color: '#6B7280', fontWeight: '700' },
  windowRow: { flexDirection: 'row', gap: 8 },
  windowButton: {
    minWidth: 92,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  windowButtonSelected: { borderColor: '#0A84FF', backgroundColor: '#E8F0FF' },
  windowText: { color: '#374151', fontWeight: '800' },
  windowTextSelected: { color: '#0A84FF' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  noteInput: { minHeight: 92, textAlignVertical: 'top' },
  primaryButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
