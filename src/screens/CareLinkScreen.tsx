import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import SafeLayout from '../components/SafeLayout';
import { createInvite, acceptInvite } from '../utils/careApi';

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
      <View style={{ flex: 1, padding: 20, gap: 16 }}>
        {/* Top toggle */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['share', 'follow'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setTab(v)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: tab === v ? '#0A84FF' : '#e5e7eb',
                backgroundColor: tab === v ? '#E8F0FF' : '#fff',
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: tab === v ? '#0A84FF' : '#111',
                }}
              >
                {v === 'share' ? 'Share my meds' : 'Follow someone'}
              </Text>
            </Pressable>
          ))}
        </View>

        {linkedBanner && (
          <View
            style={{
              padding: 10,
              backgroundColor: '#E8F5E9',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#C8E6C9',
            }}
          >
            <Text style={{ color: '#256029' }}>{linkedBanner}</Text>
          </View>
        )}

        {tab === 'share' ? (
          <View style={{ gap: 12 }}>
            <Text>
              Generate a one‑time code and send it to your caregiver. It expires
              in 30 minutes.
            </Text>

            <Pressable
              onPress={doCreate}
              disabled={busy}
              style={{
                opacity: busy ? 0.6 : 1,
                backgroundColor: '#0A84FF',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Generate Code
                </Text>
              )}
            </Pressable>

            {gen?.code && (
              <View
                style={{
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: '800',
                    letterSpacing: 2,
                    textAlign: 'center',
                  }}
                >
                  {gen.code}
                </Text>
                <Text style={{ textAlign: 'center', color: '#666' }}>
                  Expires ~ {gen.exp}
                </Text>

                <Pressable
                  onPress={doShare}
                  style={{
                    alignSelf: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#F3F4F6',
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>Share code</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text>Enter the code they shared with you:</Text>

            <TextInput
              placeholder="e.g. 7K3F9ZQV"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 10,
                padding: 12,
                letterSpacing: 2,
              }}
            />

            <Pressable
              onPress={doAccept}
              disabled={busy || !code.trim()}
              style={{
                opacity: busy || !code.trim() ? 0.6 : 1,
                backgroundColor: '#0A84FF',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>Link</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeLayout>
  );
}