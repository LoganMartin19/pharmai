import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Geolocation from '@react-native-community/geolocation';
import SafeLayout from '../components/SafeLayout';
import { useReminders } from '../context/RemindersContext';
import { auth, db } from '../firebase';
import type { RootStackParamList } from '../navigation/MainNavigator';
import type { Medication } from '../types/Medication';
import { findNearbyPharmacies } from '../utils/pharmacySearch';
import type { Pharmacy } from '../utils/pharmacySearch';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Coords = { latitude: number; longitude: number };
type RefillRequest = {
  id: string;
  status: string;
  medication?: { name?: string };
  pharmacy?: { name?: string };
  expiresAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
};

const REFILL_WINDOW_DAYS = 10;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date?: string) {
  if (!date) return undefined;
  const today = new Date(`${isoToday()}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / 86400000);
}

function getRefillStatus(med: Medication) {
  const remainingDays = daysUntil(med.endDate);
  if (typeof remainingDays !== 'number') return 'No end date';
  if (remainingDays < 0) return 'Past refill date';
  if (remainingDays === 0) return 'Refill today';
  if (remainingDays === 1) return '1 day left';
  return `${remainingDays} days left`;
}

function formatAvailability(status?: Pharmacy['availabilityStatus']) {
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
      return 'Call to confirm';
    default:
      return undefined;
  }
}

function formatRequestStatus(status?: string) {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'need_more_info':
      return 'Needs info';
    case 'out_of_stock':
      return 'Out of stock';
    case 'ready_later':
      return 'Ready later';
    case 'expired':
      return 'Expired';
    case 'rejected':
      return 'Rejected';
    case 'pending':
    default:
      return 'Pending';
  }
}

function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position: { coords: Coords }) => resolve(position.coords),
      (error: { message?: string }) => reject(new Error(error?.message || 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export default function RefillScreen() {
  const navigation = useNavigation<Nav>();
  const { reminders } = useReminders();
  const [location, setLocation] = useState<Coords | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [requests, setRequests] = useState<RefillRequest[]>([]);

  const refillMeds = useMemo(() => {
    return reminders
      .map((med) => ({ med, remainingDays: daysUntil(med.endDate) }))
      .filter(({ med, remainingDays }) => med.repeatPrescription || typeof remainingDays === 'number')
      .sort((a, b) => (a.remainingDays ?? 9999) - (b.remainingDays ?? 9999));
  }, [reminders]);

  const dueSoonCount = refillMeds.filter(
    ({ remainingDays }) => typeof remainingDays === 'number' && remainingDays <= REFILL_WINDOW_DAYS
  ).length;

  const loadRequests = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setRequests([]);
      return;
    }

    try {
      const snap = await getDocs(query(collection(db, 'pharmacyRequests'), where('userUid', '==', user.uid)));
      const rows = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<RefillRequest, 'id'>) }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.().getTime?.() ?? 0;
          const bTime = b.createdAt?.toDate?.().getTime?.() ?? 0;
          return bTime - aTime;
        })
        .slice(0, 4);
      setRequests(rows);
    } catch (e) {
      console.warn('Unable to load refill requests', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const loadNearby = async () => {
    try {
      setLoadingPharmacies(true);
      const coords = await getCurrentLocation();
      setLocation(coords);
      const rows = await findNearbyPharmacies(coords);
      setPharmacies(rows);
      if (rows.length === 0) {
        Alert.alert('No pharmacies found', 'Try again later or search from Maps.');
      }
    } catch (e: any) {
      Alert.alert('Location unavailable', e?.message || 'Please enable location services and try again.');
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const openMaps = (pharmacy: Pharmacy) => {
    const query = encodeURIComponent(`${pharmacy.name} ${pharmacy.address ?? ''}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.apple.com/?q=${query}`);
    });
  };

  return (
    <SafeLayout>
      <FlatList
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Refills</Text>
            <View style={styles.summary}>
              <Text style={styles.summaryNumber}>{dueSoonCount}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>Due in the next {REFILL_WINDOW_DAYS} days</Text>
                <Text style={styles.summarySub}>Repeat prescriptions and medication end dates appear here.</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Medication refills</Text>
            {refillMeds.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No refill dates yet</Text>
                <Text style={styles.emptyText}>Add an end date or mark a medication as repeat prescription.</Text>
              </View>
            ) : (
              refillMeds.map(({ med, remainingDays }) => {
                const urgent = typeof remainingDays === 'number' && remainingDays <= REFILL_WINDOW_DAYS;
                return (
                  <Pressable
                    key={med.id}
                    style={[styles.medCard, urgent && styles.medCardUrgent]}
                    onPress={() => navigation.navigate('AddReminder', { medication: med })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medName}>{med.name}</Text>
                      <Text style={styles.medDetail}>{med.dosage}{med.time ? ` • ${med.time}` : ''}</Text>
                    </View>
                    <View style={[styles.statusPill, urgent && styles.statusPillUrgent]}>
                      <Text style={[styles.statusText, urgent && styles.statusTextUrgent]}>
                        {getRefillStatus(med)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}

            {requests.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Recent requests</Text>
                {requests.map((request) => (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestTitle}>
                        {request.medication?.name || 'Medication'} at {request.pharmacy?.name || 'Pharmacy'}
                      </Text>
                      <Text style={styles.requestDetail}>
                        Expires {request.expiresAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? 'soon'}
                      </Text>
                    </View>
                    <View style={styles.requestStatus}>
                      <Text style={styles.requestStatusText}>{formatRequestStatus(request.status)}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            <View style={styles.pharmacyHeader}>
              <Text style={styles.sectionTitle}>Nearby pharmacies</Text>
              <Pressable onPress={loadNearby} disabled={loadingPharmacies} style={styles.locationButton}>
                {loadingPharmacies ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationButtonText}>Use location</Text>}
              </Pressable>
            </View>

            {location ? (
              <Text style={styles.disclosure}>Sponsored pharmacies are labelled and distance is shown.</Text>
            ) : (
              <Text style={styles.disclosure}>Enable location to find nearby pharmacies.</Text>
            )}
          </View>
        }
        data={pharmacies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 28 }}
        renderItem={({ item, index }) => {
          const availability = formatAvailability(item.availabilityStatus);
          return (
          <View style={styles.pharmacyCard}>
            <Pressable style={styles.pharmacyMain} onPress={() => openMaps(item)}>
            <View style={styles.rankCircle}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.pharmacyTitleRow}>
                <Text style={styles.pharmacyName}>{item.name}</Text>
                {item.sponsored ? (
                  <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>Sponsored</Text>
                  </View>
                ) : null}
              </View>
              {availability ? (
                <View style={styles.availabilityBadge}>
                  <Text style={styles.availabilityText}>{availability}</Text>
                </View>
              ) : null}
              {item.address ? <Text style={styles.pharmacyDetail}>{item.address}</Text> : null}
              <Text style={styles.pharmacyDetail}>
                {item.distanceMiles.toFixed(1)} miles away{item.openingHours ? ` • ${item.openingHours}` : ''}
              </Text>
            </View>
            </Pressable>
            <View style={styles.pharmacyActions}>
              <Pressable style={styles.secondaryButton} onPress={() => openMaps(item)}>
                <Text style={styles.secondaryButtonText}>Directions</Text>
              </Pressable>
              <Pressable
                style={styles.requestButton}
                onPress={() => navigation.navigate('PharmacyRefillRequest', { pharmacy: item })}
              >
                <Text style={styles.requestButtonText}>Request refill</Text>
              </Pressable>
            </View>
          </View>
        );
        }}
        ListEmptyComponent={
          location && !loadingPharmacies ? (
            <Text style={styles.emptyPharmacies}>No pharmacy results loaded.</Text>
          ) : null
        }
      />
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', marginBottom: 14, color: '#111827' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EEF7F2',
    borderWidth: 1,
    borderColor: '#CDE9D8',
    marginBottom: 20,
  },
  summaryNumber: { fontSize: 34, fontWeight: '800', color: '#17633A', minWidth: 42, textAlign: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#143D2A' },
  summarySub: { fontSize: 13, color: '#416052', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10 },
  emptyBox: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 18,
  },
  emptyTitle: { fontWeight: '700', color: '#111827', marginBottom: 4 },
  emptyText: { color: '#6B7280' },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  medCardUrgent: { borderColor: '#F2B8A0', backgroundColor: '#FFF8F4' },
  medName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  medDetail: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  statusPillUrgent: { backgroundColor: '#FFE7DC' },
  statusText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  statusTextUrgent: { color: '#9A3412' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  requestTitle: { fontWeight: '800', color: '#111827' },
  requestDetail: { color: '#6B7280', marginTop: 3, fontSize: 13 },
  requestStatus: { borderRadius: 999, backgroundColor: '#E8F0FF', paddingHorizontal: 9, paddingVertical: 5 },
  requestStatusText: { color: '#0A53B8', fontWeight: '800', fontSize: 12 },
  pharmacyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  locationButton: {
    minWidth: 112,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: { color: '#fff', fontWeight: '800' },
  disclosure: { color: '#6B7280', fontSize: 13, marginBottom: 10 },
  pharmacyCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  pharmacyMain: { flexDirection: 'row', gap: 12 },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: '#0A53B8', fontWeight: '800' },
  pharmacyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pharmacyName: { fontSize: 16, fontWeight: '800', color: '#111827', flexShrink: 1 },
  pharmacyDetail: { color: '#6B7280', marginTop: 3, fontSize: 13 },
  sponsoredBadge: { backgroundColor: '#FDECC8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sponsoredText: { color: '#7A4A00', fontSize: 11, fontWeight: '800' },
  availabilityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  availabilityText: { color: '#0A53B8', fontSize: 11, fontWeight: '800' },
  pharmacyActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#374151', fontWeight: '800' },
  requestButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonText: { color: '#fff', fontWeight: '800' },
  emptyPharmacies: { color: '#6B7280', textAlign: 'center', marginTop: 16 },
});
