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
  Image,
  Linking,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Msg } from '../types/chat';
import { sendChatMessage } from '../api/chat';
import SafeLayout from '../components/SafeLayout';
import { auth, db } from '../firebase';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, shadow, spacing, type } from '../theme';
import { Eyebrow } from '../components/Primitives';

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const { width } = useWindowDimensions();
  const showPermanentHistory = width >= 760;

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
        return { role: data.role, content: data.content, nhsAttribution: data.nhsAttribution };
      }));
      setTimeout(scrollToEnd, 50);
      setHistoryOpen(false);
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

    const nextMessages = preset && messages.length === 1 && messages[0]?.content === preset.content
      ? messages
      : [...messages, mine];
    setMessages(nextMessages);
    if (!preset) setInput('');
    setLoading(true);
    setTimeout(scrollToEnd, 10);

    try {
      const data = await sendChatMessage(nextMessages, chatId);
      if (data.chatId && !chatId) setChatId(data.chatId);

      setMessages((cur) => [...cur, {
        role: 'assistant',
        content: data.reply,
        nhsAttribution: data.nhsAttribution || undefined,
      }]);
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
    setHistoryOpen(false);
  };

  const historyPanel = (
    <View style={[styles.historyPanel, showPermanentHistory && styles.historyPanelPermanent]}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyHeading}>Conversations</Text>
        {!showPermanentHistory && (
          <Pressable accessibilityLabel="Close chat history" onPress={() => setHistoryOpen(false)} style={styles.headerIconButton}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        )}
      </View>
      <Pressable onPress={startNew} style={styles.newConversationButton}>
        <Ionicons name="add" size={19} color={colors.white} />
        <Text style={styles.newConversationText}>New conversation</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
        {history.length ? history.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => loadConversation(item)}
            style={[styles.drawerHistoryItem, item.id === chatId && styles.drawerHistoryItemActive]}
          >
            <Ionicons name="chatbubble-outline" size={17} color={item.id === chatId ? colors.brand : colors.inkMuted} />
            <View style={styles.drawerHistoryCopy}>
              <Text style={[styles.drawerHistoryTitle, item.id === chatId && styles.drawerHistoryTitleActive]} numberOfLines={2}>{item.title}</Text>
            </View>
          </Pressable>
        )) : (
          <Text style={styles.emptyHistory}>Your previous medication conversations will appear here.</Text>
        )}
      </ScrollView>
      <View style={styles.historyPrivacy}>
        <Ionicons name="lock-closed-outline" size={15} color={colors.inkMuted} />
        <Text style={styles.historyPrivacyText}>Private to your account</Text>
      </View>
    </View>
  );

  return (
    <SafeLayout style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <View style={styles.workspace}>
          {showPermanentHistory && historyPanel}
          <View style={styles.chatPane}>
            <View style={styles.topBar}>
              {!showPermanentHistory && (
                <Pressable accessibilityLabel="Open chat history" onPress={() => setHistoryOpen(true)} style={styles.headerIconButton}>
                  <Ionicons name="menu" size={23} color={colors.ink} />
                </Pressable>
              )}
              <View style={styles.topBarCopy}><Text style={styles.topBarTitle}>Ask PharmAI</Text><Text style={styles.topBarSubtitle}>Medication support</Text></View>
              <Pressable accessibilityLabel="Start a new chat" onPress={startNew} style={styles.headerIconButton}>
                <Ionicons name="create-outline" size={21} color={colors.brand} />
              </Pressable>
            </View>
            <FlatList
              ref={listRef}
              contentContainerStyle={styles.messages}
              data={[...messages, ...(loading ? [{ role: 'assistant', content: '__typing__' } as Msg] : [])]}
              keyExtractor={(_, i) => String(i)}
              ListHeaderComponent={messages.length === 0 ? <View style={styles.emptyChat}><Eyebrow>NHS-grounded support</Eyebrow><Text style={styles.title}>What can I help with?</Text><Text style={styles.subtitle}>Ask about timing, side effects, interactions, or what to check with a pharmacist. Medicine answers are grounded in retrieved NHS content.</Text></View> : null}
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
                {!mine && item.nhsAttribution && (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Open the source article on the NHS website"
                    onPress={() => Linking.openURL(item.nhsAttribution!.sourceUrl)}
                    style={styles.nhsAttribution}
                  >
                    {!!item.nhsAttribution.logoUrl && (
                      <Image
                        source={{ uri: item.nhsAttribution.logoUrl }}
                        resizeMode="contain"
                        style={styles.nhsLogo}
                      />
                    )}
                    <Text style={styles.nhsAttributionText}>{item.nhsAttribution.label}</Text>
                    <Text style={styles.nhsSourceLink}>View source on NHS.uk</Text>
                  </Pressable>
                )}
              </View>
            );
              }}
            />
            <View style={styles.inputRow}>
              <TextInput value={input} onChangeText={setInput} placeholder="Ask about your medication..." placeholderTextColor={colors.inkMuted} style={styles.input} multiline />
              <Pressable style={[styles.send, loading && { opacity: 0.5 }]} onPress={() => send()} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white}/>
                ) : (
                  <Ionicons name="arrow-up" size={20} color={colors.white}/>
                )}
              </Pressable>
            </View>
          </View>
        </View>
        {!showPermanentHistory && historyOpen && <View style={styles.drawerLayer}><Pressable style={styles.drawerBackdrop} onPress={() => setHistoryOpen(false)} />{historyPanel}</View>}
      </KeyboardAvoidingView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  safe: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  keyboard: { flex: 1 },
  workspace: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  chatPane: { flex: 1, minWidth: 0 },
  topBar: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.surface },
  topBarCopy: { flex: 1 },
  topBarTitle: { ...type.heading, color: colors.ink },
  topBarSubtitle: { ...type.caption, color: colors.inkMuted },
  headerIconButton: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  messages: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 18, flexGrow: 1 },
  title: { ...type.hero, color: colors.ink, marginTop: 7, marginBottom: 7 },
  subtitle: { ...type.body, color: colors.inkMuted, marginBottom: 22 },
  emptyChat: { paddingTop: 22, maxWidth: 620 },
  bubble: { marginBottom: 12, maxWidth: '86%', padding: 14, borderRadius: radius.lg, flexShrink: 1 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.brand, borderBottomRightRadius: 6 },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderBottomLeftRadius: 6 },
  typing: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  messageText: { flexShrink: 1, flexWrap: 'wrap', lineHeight: 21, fontSize: 15 },
  headingText: { fontWeight: '900', color: '#111827' },
  userText: { color: '#fff' },
  botText: { color: colors.ink },
  nhsAttribution: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1', marginTop: 10, paddingTop: 9 },
  nhsLogo: { width: 150, height: 48, alignSelf: 'flex-start' },
  nhsAttributionText: { color: '#475569', fontSize: 12, lineHeight: 17 },
  nhsSourceLink: { color: '#005EB8', fontWeight: '800', fontSize: 12, marginTop: 3, textDecorationLine: 'underline' },
  inputRow: { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 16 : 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.background },
  input: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.lg, color: colors.ink },
  send: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '800' },
  drawerLayer: { ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: 'row' },
  drawerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#11182766' },
  historyPanel: { width: '84%', maxWidth: 320, height: '100%', zIndex: 21, backgroundColor: colors.surface, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line, paddingTop: spacing.lg },
  historyPanelPermanent: { width: 286, zIndex: 0 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  historyHeading: { ...type.heading, color: colors.ink },
  newConversationButton: { marginHorizontal: spacing.md, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  newConversationText: { ...type.label, color: colors.white },
  historyList: { padding: spacing.md, gap: spacing.xs },
  drawerHistoryItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  drawerHistoryItemActive: { backgroundColor: colors.brandSoft },
  drawerHistoryCopy: { flex: 1 },
  drawerHistoryTitle: { ...type.label, color: colors.inkMuted },
  drawerHistoryTitleActive: { color: colors.brandDark },
  emptyHistory: { ...type.body, color: colors.inkMuted, padding: spacing.sm },
  historyPrivacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: 'auto', padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  historyPrivacyText: { ...type.caption, color: colors.inkMuted },
});
