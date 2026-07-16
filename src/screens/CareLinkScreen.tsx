import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  ScrollView,
} from 'react-native';
import SafeLayout from '../components/SafeLayout';
import { createInvite, acceptInvite } from '../utils/careApi';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Eyebrow } from '../components/Primitives';
import { colors, radius, shadow, spacing, type } from '../theme';

export default function CareLinkScreen() {
  const [tab, setTab] = useState<'share' | 'follow'>('share');
  const [code, setCode] = useState('');
  const [gen, setGen] = useState<{ code?: string; exp?: string }>();
  const [busy, setBusy] = useState(false);
  const [linkedBanner, setLinkedBanner] = useState<string | null>(null);

  const doCreate = async () => {
    try {
      setBusy(true);
      const r = await createInvite();
      setGen({
        code: r.inviteId,
        exp: new Date(r.expiresAt).toLocaleTimeString(),
      });
    } catch {
      Alert.alert('Error', 'Could not create invite.');
    } finally {
      setBusy(false);
    }
  };

  const doShare = async () => {
    if (!gen?.code) return;
    try {
      await Share.share({
        message: `PharmAI caregiver code: ${gen.code} (expires ~${gen.exp})`,
      });
    } catch {}
  };

  const doAccept = async () => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    try {
      setBusy(true);
      await acceptInvite(cleaned);
      setLinkedBanner('Linked! You can now view their medications in Care.');
      setCode('');
      // auto-hide banner
      setTimeout(() => setLinkedBanner(null), 3500);
    } catch {
      Alert.alert('Error', 'Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeLayout>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Eyebrow>CARE CIRCLE</Eyebrow>
        <Text style={styles.title}>Support, with consent</Text>
        <Text style={styles.subtitle}>Share medication progress with someone you trust, or securely follow someone who has invited you.</Text>
        {/* Top toggle */}
        <View style={styles.tabs}>
          {(['share', 'follow'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setTab(v)}
              style={[styles.tab, tab === v && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, tab === v && styles.tabTextActive]}
              >
                {v === 'share' ? 'Share my meds' : 'Follow someone'}
              </Text>
            </Pressable>
          ))}
        </View>

        {linkedBanner && (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={20} color={colors.brandDark} />
            <Text style={styles.successText}>{linkedBanner}</Text>
          </View>
        )}

        {tab === 'share' ? (
          <View style={styles.card}>
            <View style={styles.icon}><Ionicons name="share-social-outline" size={24} color={colors.brandDark} /></View>
            <Text style={styles.cardTitle}>Invite a trusted person</Text>
            <Text style={styles.body}>
              Generate a one‑time code and send it to your caregiver. It expires
              in 30 minutes.
            </Text>

            <Pressable
              onPress={doCreate}
              disabled={busy}
              style={[styles.primaryButton, busy && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Generate secure code
                </Text>
              )}
            </Pressable>

            {gen?.code && (
              <View style={styles.codeCard}>
                <Text style={styles.code}>
                  {gen.code}
                </Text>
                <Text style={styles.expiry}>
                  Expires ~ {gen.exp}
                </Text>

                <Pressable
                  onPress={doShare}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Share code</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.icon}><Ionicons name="people-outline" size={24} color={colors.brandDark} /></View>
            <Text style={styles.cardTitle}>Accept an invitation</Text>
            <Text style={styles.body}>Enter the one-time code they shared with you.</Text>

            <TextInput
              placeholder="e.g. 7K3F9ZQV"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />

            <Pressable
              onPress={doAccept}
              disabled={busy || !code.trim()}
              style={[styles.primaryButton, (busy || !code.trim()) && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Connect securely</Text>
              )}
            </Pressable>
          </View>
        )}
        <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={18} color={colors.inkMuted} /><Text style={styles.privacyText}>Access can be revoked at any time. Only the medication information you permit is shared.</Text></View>
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  title: { ...type.title, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  tabText: { ...type.label, color: colors.inkMuted },
  tabTextActive: { color: colors.brandDark },
  success: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md, backgroundColor: colors.brandSoft, borderRadius: radius.md, marginBottom: spacing.md },
  successText: { flex: 1, color: colors.brandDark, fontWeight: '600' },
  card: { gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, ...shadow.card },
  icon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  primaryButton: { backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  codeCard: { padding: spacing.lg, backgroundColor: colors.background, borderRadius: radius.md, gap: spacing.sm },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 3, textAlign: 'center', color: colors.ink },
  expiry: { textAlign: 'center', color: colors.inkMuted },
  secondaryButton: { alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  secondaryButtonText: { color: colors.brandDark, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, letterSpacing: 3, fontSize: 18, color: colors.ink, backgroundColor: colors.background },
  privacy: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.sm },
  privacyText: { ...type.caption, color: colors.inkMuted, flex: 1 },
});
