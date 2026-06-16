import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import SafeLayout from '../components/SafeLayout';
import { auth, db } from '../firebase';

type Partner = {
  id: string;
  name?: string;
  matcher?: string;
  active?: boolean;
};

type PharmacyRequest = {
  id: string;
  status: string;
  statusHistory?: Array<Record<string, any>>;
  userUid: string;
  contact?: string;
  note?: string | null;
  responseWindowMinutes?: number;
  expiresAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
  medication?: {
    name?: string;
    dosage?: string;
    frequency?: string;
    endDate?: string;
  };
  pharmacy?: {
    name?: string;
  };
};

const STATUS_ACTIONS = [
  { status: 'accepted', label: 'Accept' },
  { status: 'ready_later', label: 'Ready later' },
  { status: 'need_more_info', label: 'Need info' },
  { status: 'out_of_stock', label: 'Out of stock' },
  { status: 'rejected', label: 'Reject' },
];

function statusLabel(status?: string) {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'ready_later':
      return 'Ready later';
    case 'need_more_info':
      return 'Needs info';
    case 'out_of_stock':
      return 'Out of stock';
    case 'rejected':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    case 'pending':
    default:
      return 'Pending';
  }
}

function isExpired(request: PharmacyRequest) {
  const expiresAt = request.expiresAt?.toDate?.();
  return !!expiresAt && expiresAt.getTime() < Date.now() && request.status === 'pending';
}

export default function PharmacyPortalScreen() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [requests, setRequests] = useState<PharmacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const partnerIds = useMemo(() => partners.map((partner) => partner.id), [partners]);

  const loadPortal = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setPartners([]);
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const partnerSnap = await getDocs(query(collection(db, 'pharmacyPartners'), where('ownerUid', '==', user.uid)));
      const ownedPartners = partnerSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Partner, 'id'>),
      }));
      setPartners(ownedPartners);

      const ids = ownedPartners.map((partner) => partner.id);
      if (ids.length === 0) {
        setRequests([]);
        return;
      }

      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

      const requestRows: PharmacyRequest[] = [];
      for (const chunk of chunks) {
        const reqSnap = await getDocs(
          query(collection(db, 'pharmacyRequests'), where('pharmacyPartnerId', 'in', chunk))
        );
        reqSnap.docs.forEach((docSnap) => {
          requestRows.push({ id: docSnap.id, ...(docSnap.data() as Omit<PharmacyRequest, 'id'>) });
        });
      }

      requestRows.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.().getTime?.() ?? 0;
        const bTime = b.createdAt?.toDate?.().getTime?.() ?? 0;
        return bTime - aTime;
      });
      setRequests(requestRows);
    } catch (e: any) {
      console.warn('load pharmacy portal failed', e);
      Alert.alert('Unable to load portal', e?.message || 'Check your pharmacy account permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPortal();
    }, [loadPortal])
  );

  const updateStatus = async (request: PharmacyRequest, status: string) => {
    try {
      setSavingId(request.id);
      const historyEntry = {
        status,
        at: new Date().toISOString(),
        actorUid: auth.currentUser?.uid ?? null,
      };
      await updateDoc(doc(db, 'pharmacyRequests', request.id), {
        status,
        updatedAt: serverTimestamp(),
        lastPharmacyActionAt: serverTimestamp(),
        statusHistory: [...(request.statusHistory ?? []), historyEntry],
      });
      setRequests((prev) => prev.map((row) => (row.id === request.id ? { ...row, status } : row)));
    } catch (e: any) {
      console.warn('update pharmacy request failed', e);
      Alert.alert('Could not update request', e?.message || 'Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SafeLayout>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Pharmacy portal</Text>
        {partners.length > 0 ? (
          <Text style={styles.subtitle}>
            {partners.map((partner) => partner.name || partner.matcher || partner.id).join(', ')}
          </Text>
        ) : (
          <Text style={styles.subtitle}>No pharmacy partner profile is linked to this account.</Text>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : partnerIds.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Partner setup needed</Text>
            <Text style={styles.emptyText}>
              Add this account as `ownerUid` on a `pharmacyPartners` document to receive refill requests.
            </Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptyText}>Incoming patient refill requests will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 28 }}
            renderItem={({ item }) => {
              const expired = isExpired(item);
              const displayStatus = expired ? 'expired' : item.status;
              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medName}>{item.medication?.name || 'Medication'}</Text>
                      <Text style={styles.detail}>
                        {item.medication?.dosage || 'Dosage not supplied'}
                        {item.medication?.frequency ? ` • ${item.medication.frequency}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, expired && styles.expiredBadge]}>
                      <Text style={[styles.statusText, expired && styles.expiredText]}>{statusLabel(displayStatus)}</Text>
                    </View>
                  </View>

                  <Text style={styles.detail}>Contact: {item.contact || 'Not supplied'}</Text>
                  {item.note ? <Text style={styles.note}>Note: {item.note}</Text> : null}
                  <Text style={styles.detail}>
                    Respond by {item.expiresAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? 'soon'}
                  </Text>

                  <View style={styles.actions}>
                    {STATUS_ACTIONS.map((action) => (
                      <Pressable
                        key={action.status}
                        disabled={savingId === item.id || expired}
                        onPress={() => updateStatus(item, action.status)}
                        style={[
                          styles.actionButton,
                          action.status === 'rejected' && styles.rejectButton,
                          (savingId === item.id || expired) && { opacity: 0.45 },
                        ]}
                      >
                        <Text style={[
                          styles.actionText,
                          action.status === 'rejected' && styles.rejectText,
                        ]}>
                          {action.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { color: '#6B7280', marginBottom: 16 },
  emptyBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  emptyTitle: { fontWeight: '800', color: '#111827', marginBottom: 4 },
  emptyText: { color: '#6B7280', lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  medName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  detail: { color: '#6B7280', marginTop: 3 },
  note: { color: '#374151', marginTop: 8, lineHeight: 20 },
  statusBadge: { backgroundColor: '#E8F0FF', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#0A53B8', fontWeight: '800', fontSize: 12 },
  expiredBadge: { backgroundColor: '#F3F4F6' },
  expiredText: { color: '#6B7280' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: {
    borderRadius: 8,
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  actionText: { color: '#0A53B8', fontWeight: '800' },
  rejectButton: { backgroundColor: '#FEE2E2' },
  rejectText: { color: '#991B1B' },
});
