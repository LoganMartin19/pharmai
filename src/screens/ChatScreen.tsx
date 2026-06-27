import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Msg } from '../types/chat';
import { sendChatMessage } from '../api/chat';
import SafeLayout from '../components/SafeLayout';
import { auth, db } from '../firebase';

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;
type ChatSummary = { id: string; title: string; updatedAt?: any };

function cleanLine(line: string) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[-*]\s+/, '• ')
    .replace(/\*\*/g, '')
    .trimEnd();
}

function ChatText({ text, mine }: { text: string; mine: boolean }) {
  const lines = text.split('\n').map(cleanLine).filter((line, index, arr) => line || arr[index - 1]);

  return (
    <Text style={[styles.messageText, mine ? styles.userText : styles.botText]}>
      {lines.map((line, index) => {
        const isHeading = !mine && index < lines.length - 1 && line && !line.startsWith('• ') && lines[index + 1]?.startsWith('• ');
        return (
          <Text key={`${line}-${index}`} style={isHeading ? styles.headingText : undefined}>
            {line}
            {index < lines.length - 1 ? '\n' : ''}
          </Text>
        );
      })}
    </Text>
  );
}

export default function ChatScreen() {
  const { params } = useRoute<ChatRoute>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<ChatSummary[]>([]);
  const listRef = useRef<FlatList>(null);

  const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: true });

  const loadHistory = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'chats'), orderBy('updatedAt', 'desc'), limit(8))
      );
      setHistory(snap.docs.map((doc) => ({ id: doc.id, title: (doc.data().title as string) || 'Medication chat', updatedAt: doc.data().updatedAt })));
    } catch (e) {
      console.warn('load chat history failed', e);
    }
  }, []);

  const loadConversation = async (summary: ChatSummary) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'chats', summary.id, 'messages'), orderBy('createdAt', 'asc'), limit(30))
      );
      setChatId(summary.id);
      setMessages(snap.docs.map((doc) => {
        const data = doc.data() as Msg;
        return { role: data.role, content: data.content };
      }));
      setTimeout(scrollToEnd, 50);
    } catch (e) {
      console.warn('load conversation failed', e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
      setTimeout(() => send(seed), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.contextMedication]);

  const send = useCallback(async (preset?: Msg) => {
    const mine: Msg | undefined = preset ?? (input.trim() ? { role: 'user', content: input.trim() } : undefined);
    if (!mine) return;

    const nextMessages = [...messages, mine];
    setMessages((cur) => [...cur, mine]);
    if (!preset) setInput('');
    setLoading(true);
    setTimeout(scrollToEnd, 10);

    try {
      const data = await sendChatMessage(nextMessages, chatId);
      if (data.chatId && !chatId) setChatId(data.chatId);

      setMessages((cur) => [...cur, { role: 'assistant', content: data.reply }]);
      setTimeout(scrollToEnd, 10);
      loadHistory();
    } catch (e) {
      console.error(e);
      setMessages((cur) => [...cur, { role: 'assistant', content: 'Sorry, there was a problem reaching the assistant.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, chatId, loadHistory]);

  const startNew = () => {
    setChatId(undefined);
    setMessages([]);
    setInput('');
  };

  return (
    <SafeLayout style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.messages}
          data={[...messages, ...(loading ? [{ role: 'assistant', content: '__typing__' } as Msg] : [])]}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={
            messages.length === 0 ? (
              <View style={styles.historyWrap}>
                <Text style={styles.title}>Medication chat</Text>
                <Text style={styles.subtitle}>Ask about timing, side effects, interactions, or what to check with a pharmacist. Answers reference EMC and BNF.</Text>
                {history.length ? (
                  <>
                    <Text style={styles.historyTitle}>Recent chats</Text>
                    {history.map((item) => (
                      <Pressable key={item.id} style={styles.historyItem} onPress={() => loadConversation(item)}>
                        <Text style={styles.historyItemText} numberOfLines={2}>{item.title}</Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}
              </View>
            ) : (
              <View style={styles.chatHeader}>
                <Pressable onPress={startNew} style={styles.newButton}>
                  <Text style={styles.newButtonText}>New chat</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => {
            if (item.content === '__typing__') {
              return (
                <View style={[styles.bubble, styles.bot, styles.typing]}>
                  <ActivityIndicator />
                  <Text style={styles.botText}>Thinking...</Text>
                </View>
              );
            }
            const mine = item.role === 'user';
            return (
              <View style={[styles.bubble, mine ? styles.user : styles.bot]}>
                <ChatText text={item.content} mine={mine} />
              </View>
            );
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask something about your medication..."
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
          />
          <Pressable style={[styles.send, loading && { opacity: 0.5 }]} onPress={() => send()} disabled={loading}>
            <Text style={styles.sendText}>{loading ? '...' : 'Send'}</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 6 },
  subtitle: { color: '#64748B', lineHeight: 20, marginBottom: 18 },
  historyWrap: { paddingTop: 18 },
  historyTitle: { color: '#111827', fontWeight: '900', marginBottom: 8 },
  historyItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  historyItemText: { color: '#111827', fontWeight: '700' },
  chatHeader: { alignItems: 'flex-end', marginBottom: 8 },
  newButton: { backgroundColor: '#E8F0FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  newButtonText: { color: '#0A84FF', fontWeight: '800' },
  bubble: { marginBottom: 10, maxWidth: '82%', padding: 12, borderRadius: 14, flexShrink: 1 },
  user: { alignSelf: 'flex-end', backgroundColor: '#0A84FF' },
  bot: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9' },
  typing: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  messageText: { flexShrink: 1, flexWrap: 'wrap', lineHeight: 21, fontSize: 15 },
  headingText: { fontWeight: '900', color: '#111827' },
  userText: { color: '#fff' },
  botText: { color: '#111827' },
  inputRow: { flexDirection: 'row', padding: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 12, color: '#111827' },
  send: { height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '800' },
});
