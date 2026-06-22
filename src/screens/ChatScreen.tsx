import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Msg } from '../types/chat';
import { sendChatMessage } from '../api/chat';
import SafeLayout from '../components/SafeLayout';

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const { params } = useRoute<ChatRoute>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const listRef = useRef<FlatList>(null);

  const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: true });

  // Seed conversation if navigated from a medication
  useEffect(() => {
    if (params?.contextMedication) {
      const m = params.contextMedication;
      const seed: Msg = {
        role: 'user',
        content:
          `I have a question about this medication:\n`
          + `• Name: ${m.name}\n`
          + (m.dosage ? `• Dosage: ${m.dosage}\n` : '')
          + (m.frequency ? `• Frequency: ${m.frequency}\n` : '')
          + (m.time ? `• Times: ${m.time}\n` : '')
          + `Can you explain how and when to take it, and any common side effects?`,
      };
      setMessages([seed]);
      // auto-send the seeded question
      setTimeout(() => send(seed), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.contextMedication]);

  const send = useCallback(async (preset?: Msg) => {
    const mine: Msg | undefined = preset ?? (input.trim() ? { role: 'user', content: input.trim() } : undefined);
    if (!mine) return;

    setMessages(cur => [...cur, mine]);
    if (!preset) setInput('');
    setLoading(true);
    setTimeout(scrollToEnd, 10);

    try {
      const data: { reply: string; chatId?: string } = await sendChatMessage([...messages, mine], chatId);
      if (data.chatId && !chatId) setChatId(data.chatId);

      setMessages(cur => [...cur, { role: 'assistant', content: data.reply }]);
      setTimeout(scrollToEnd, 10);
    } catch (e) {
      console.error(e);
      setMessages(cur => [...cur, { role: 'assistant', content: '⚠️ Sorry, there was a problem reaching the assistant.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, chatId]);

  return (
    <SafeLayout style={styles.safe}>
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.messages}
        data={[...messages, ...(loading ? [{ role: 'assistant', content: '__typing__' } as Msg] : [])]}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          if (item.content === '__typing__') {
            return (
              <View style={[styles.bubble, styles.bot, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <ActivityIndicator />
                <Text style={styles.botText}>Thinking…</Text>
              </View>
            );
          }
          const mine = item.role === 'user';
          return (
            <View style={[styles.bubble, mine ? styles.user : styles.bot]}>
              <Text style={[styles.messageText, mine ? styles.userText : styles.botText]}>{item.content}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask something about your medication…"
          style={styles.input}
          multiline
        />
        <Pressable style={[styles.send, loading && { opacity: 0.5 }]} onPress={() => send()} disabled={loading}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{loading ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  safe: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  keyboard: { flex: 1 },
  messages: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  bubble: { marginBottom: 10, maxWidth: '78%', padding: 10, borderRadius: 12, flexShrink: 1 },
  user: { alignSelf: 'flex-end', backgroundColor: '#0A84FF' },
  bot: { alignSelf: 'flex-start', backgroundColor: '#EEE' },
  messageText: { flexShrink: 1, flexWrap: 'wrap', lineHeight: 20 },
  userText: { color: '#fff' },
  botText: { color: '#111' },
  inputRow: { flexDirection: 'row', padding: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 10 },
  send: { height: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center' },
});
