import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeLayout from '../components/SafeLayout';
import type { RootStackParamList } from '../navigation/MainNavigator';
import { findNearbyPharmacies, Pharmacy } from '../utils/pharmacySearch';
import { PHARMACY_SERVICE_META, PharmacyServiceId } from '../utils/pharmacyServices';
import type { PharmacyService } from '../utils/pharmacyServices';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Coords = { latitude: number; longitude: number };
type FilterId = 'all' | 'partner' | PharmacyServiceId;

const SERVICE_FILTER_ORDER: PharmacyServiceId[] = [
  'pharmacy_first',
  'medicines_care_review',
  'emergency_contraception',
  'stop_smoking',
  'substance_misuse',
  'delivery',
  'wheelchair_access',
  'blood_pressure',
  'flu_vaccine',
  'contraceptive_pill',
  'weight_management',
  'private_consultations',
];

function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position: { coords: Coords }) => resolve(position.coords),
      (error: { message?: string }) => reject(new Error(error?.message || 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
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

function serviceSourceLabel(service: PharmacyService) {
  if (service.source === 'verified') return 'Verified';
  if (service.source === 'nhs_scotland_activity') return 'NHS Scotland';
  if (service.source === 'osm') return 'Listed';
  return 'Listed';
}

function ServiceChip({ service }: { service: PharmacyService }) {
  const verified = service.source === 'verified';
  const nhsScotland = service.source === 'nhs_scotland_activity';
  return (
    <View style={[styles.serviceChip, verified && styles.serviceChipVerified, nhsScotland && styles.serviceChipNhs]}>
      <Text style={[styles.serviceIcon, verified && styles.serviceIconVerified, nhsScotland && styles.serviceIconNhs]}>{service.icon}</Text>
      <Text style={[styles.serviceLabel, verified && styles.serviceLabelVerified, nhsScotland && styles.serviceLabelNhs]}>{service.label}</Text>
      <Text style={[styles.serviceSource, verified && styles.serviceSourceVerified, nhsScotland && styles.serviceSourceNhs]}>
        {serviceSourceLabel(service)}
      </Text>
    </View>
  );
}

function FilterChip({
  active,
  disabled,
  label,
  count,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive, disabled && styles.filterChipDisabled]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive, disabled && styles.filterTextDisabled]}>
        {count !== undefined ? `${label} (${count})` : label}
      </Text>
    </Pressable>
  );
}

export default function PharmacyScreen() {
  const navigation = useNavigation<Nav>();
  const [location, setLocation] = useState<Coords | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const partnerCount = pharmacies.filter((pharmacy) => pharmacy.sponsored).length;
  const serviceCounts = pharmacies.reduce((counts, pharmacy) => {
    pharmacy.services?.forEach((service) => {
      counts.set(service.id, (counts.get(service.id) ?? 0) + 1);
    });
    return counts;
  }, new Map<PharmacyServiceId, number>());
  const serviceFilters = SERVICE_FILTER_ORDER
    .filter((id) => serviceCounts.has(id))
    .map((id) => ({ id, count: serviceCounts.get(id) ?? 0, label: PHARMACY_SERVICE_META[id].label }));
  serviceCounts.forEach((count, id) => {
    if (!SERVICE_FILTER_ORDER.includes(id)) serviceFilters.push({ id, count, label: PHARMACY_SERVICE_META[id].label });
  });
  const filteredPharmacies = pharmacies.filter((pharmacy) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'partner') return !!pharmacy.sponsored;
    return !!pharmacy.services?.some((service) => service.id === activeFilter);
  });

  const loadNearby = async () => {
    try {
      setLoading(true);
      setActiveFilter('all');
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
      setLoading(false);
    }
  };

  const openMaps = (pharmacy: Pharmacy) => {
    const query = encodeURIComponent(`${pharmacy.name} ${pharmacy.address ?? ''}`);
    Linking.openURL(`https://maps.apple.com/?q=${query}`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  return (
    <SafeLayout>
      <FlatList
        data={filteredPharmacies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 28 }}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Pharmacies</Text>
            <Text style={styles.subtitle}>
              Find nearby pharmacies and see services listed by public data or verified partner profiles.
            </Text>

            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Services at a glance</Text>
                <Text style={styles.heroText}>
                  NHS Scotland activity appears when a contractor code can be matched. Partner pharmacies can verify services directly.
                </Text>
              </View>
              <Pressable style={styles.locationButton} disabled={loading} onPress={loadNearby}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationButtonText}>Use location</Text>}
              </Pressable>
            </View>

            <View style={styles.legendRow}>
              <Text style={styles.legendVerified}>Verified</Text>
              <Text style={styles.legendNhs}>NHS Scotland</Text>
              <Text style={styles.legendListed}>Listed</Text>
            </View>

            {pharmacies.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <FilterChip
                  label="All"
                  count={pharmacies.length}
                  active={activeFilter === 'all'}
                  onPress={() => setActiveFilter('all')}
                />
                <FilterChip
                  label="Partners"
                  count={partnerCount}
                  active={activeFilter === 'partner'}
                  disabled={partnerCount === 0}
                  onPress={() => setActiveFilter('partner')}
                />
                {serviceFilters.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    label={filter.label}
                    count={filter.count}
                    active={activeFilter === filter.id}
                    onPress={() => setActiveFilter(filter.id)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {location ? (
              <Text style={styles.disclosure}>Partner pharmacies are prioritised where available.</Text>
            ) : (
              <Text style={styles.disclosure}>Enable location to load pharmacies near you.</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const availability = formatAvailability(item.availabilityStatus);
          const services = item.services ?? [];

          return (
            <View style={styles.card}>
              <Pressable style={styles.cardMain} onPress={() => openMaps(item)}>
                <View style={styles.rankCircle}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.sponsored ? (
                      <View style={styles.partnerBadge}>
                        <Text style={styles.partnerText}>Partner</Text>
                      </View>
                    ) : null}
                  </View>
                  {availability ? (
                    <View style={styles.availabilityBadge}>
                      <Text style={styles.availabilityText}>{availability}</Text>
                    </View>
                  ) : null}
                  {item.address ? <Text style={styles.detail}>{item.address}</Text> : null}
                  <Text style={styles.detail}>
                    {item.distanceMiles.toFixed(1)} miles away{item.openingHours ? ` • ${item.openingHours}` : ''}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.servicesWrap}>
                {services.length > 0 ? (
                  services.slice(0, 10).map((service) => (
                    <ServiceChip key={`${service.id}-${service.source}`} service={service} />
                  ))
                ) : (
                  <Text style={styles.noServicesText}>No specific services listed yet.</Text>
                )}
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.secondaryButton} onPress={() => openMaps(item)}>
                  <Text style={styles.secondaryButtonText}>Directions</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('PharmacyRefillRequest', { pharmacy: item })}
                >
                  <Text style={styles.primaryButtonText}>Request refill</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={location && !loading ? (
          <Text style={styles.emptyText}>
            {pharmacies.length > 0 ? 'No pharmacies match this filter yet.' : 'No pharmacy results loaded.'}
          </Text>
        ) : null}
      />
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { color: '#6B7280', marginBottom: 14 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8E7F5',
    backgroundColor: '#F1F7FD',
    marginBottom: 10,
  },
  heroTitle: { color: '#123B5D', fontWeight: '800', fontSize: 16 },
  heroText: { color: '#456579', fontSize: 13, marginTop: 3 },
  locationButton: {
    minWidth: 112,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  locationButtonText: { color: '#fff', fontWeight: '800' },
  legendRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipActive: { borderColor: '#0A84FF', backgroundColor: '#E8F0FF' },
  filterChipDisabled: { opacity: 0.45 },
  filterText: { color: '#374151', fontWeight: '800', fontSize: 12 },
  filterTextActive: { color: '#0A53B8' },
  filterTextDisabled: { color: '#6B7280' },
  legendVerified: {
    color: '#17633A',
    backgroundColor: '#E7F5EC',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  legendListed: {
    color: '#0A53B8',
    backgroundColor: '#E8F0FF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  legendNhs: {
    color: '#174E63',
    backgroundColor: '#E6F7FB',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  disclosure: { color: '#6B7280', fontSize: 13, marginBottom: 10 },
  card: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  cardMain: { flexDirection: 'row', gap: 12 },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: '#0A53B8', fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 16, fontWeight: '800', color: '#111827', flexShrink: 1 },
  detail: { color: '#6B7280', marginTop: 3, fontSize: 13 },
  partnerBadge: { backgroundColor: '#E7F5EC', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  partnerText: { color: '#17633A', fontSize: 11, fontWeight: '800' },
  availabilityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  availabilityText: { color: '#0A53B8', fontSize: 11, fontWeight: '800' },
  servicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#F1D98D',
    backgroundColor: '#FFF9E8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  serviceChipVerified: { borderColor: '#BFE4CB', backgroundColor: '#EEF9F1' },
  serviceChipNhs: { borderColor: '#B7E4EF', backgroundColor: '#EDFBFE' },
  serviceIcon: { color: '#7A5A12', fontSize: 11, fontWeight: '900' },
  serviceIconVerified: { color: '#17633A' },
  serviceIconNhs: { color: '#17607A' },
  serviceLabel: { color: '#3F3215', fontSize: 12, fontWeight: '800' },
  serviceLabelVerified: { color: '#143D2A' },
  serviceLabelNhs: { color: '#123B4C' },
  serviceSource: { color: '#7A5A12', fontSize: 10, fontWeight: '700' },
  serviceSourceVerified: { color: '#17633A' },
  serviceSourceNhs: { color: '#17607A' },
  noServicesText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
  primaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  emptyText: { color: '#6B7280', textAlign: 'center', marginTop: 16 },
});
