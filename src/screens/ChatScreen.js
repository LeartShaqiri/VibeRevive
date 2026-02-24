import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

export default function ChatScreen({ navigation, route }) {
  const { contactId, contactName, vibeCode, token, displayName } = route.params;

  const [messages,  setMessages]  = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);

  const scrollRef  = useRef(null);
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const pollRef    = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    fetchMessages();
    // Poll for new messages every 3 seconds
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  const fetchMessages = async () => {
    try {
      const data = await api.getMessages(token, contactId);
      setMessages(data.messages || []);
    } catch (err) {
      console.log('Error fetching messages:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    setSending(true);

    // Optimistic update — show message immediately
    const tempMsg = {
      id:          Date.now(),
      sender_id:   0,
      text,
      sent_at:     new Date().toISOString(),
      is_me:       true,
      sender_name: displayName,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await api.sendMessage(token, contactId, text);
      await fetchMessages(); // refresh to get real message from server
    } catch (err) {
      console.log('Error sending:', err.message);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const contactInitials = contactName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{contactInitials}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{contactName}</Text>
            <Text style={styles.headerVibeCode}>{vibeCode}</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7B5EA7" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatAvatar}>
                  <Text style={styles.emptyChatAvatarText}>{contactInitials}</Text>
                </View>
                <Text style={styles.emptyChatName}>{contactName}</Text>
                <Text style={styles.emptyChatCode}>{vibeCode}</Text>
                <Text style={styles.emptyChatHint}>Say hi to start the vibe! 👋</Text>
              </View>
            ) : (
              messages.map((msg, i) => {
                const showTime = i === 0 || i === messages.length - 1 ||
                  new Date(messages[i].sent_at) - new Date(messages[i - 1]?.sent_at) > 5 * 60 * 1000;
                return (
                  <View key={msg.id}>
                    {showTime && (
                      <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>
                    )}
                    <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
                      <View style={[styles.msgBubble, msg.is_me ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                        <Text style={[styles.msgText, msg.is_me && styles.msgTextMe]}>{msg.text}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ── Input ── */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder={`Message ${contactName.split(' ')[0]}...`}
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              autoCorrect={false}
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            activeOpacity={0.85}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(107,107,138,0.08)', backgroundColor: '#FAFAF8', gap: 10 },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A2E' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerName: { fontSize: 16, color: '#1A1A2E', fontWeight: '600' },
  headerVibeCode: { fontSize: 11, color: '#B39DDB', letterSpacing: 0.5, marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },

  emptyChat: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyChatAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyChatAvatarText: { color: '#fff', fontSize: 28, fontWeight: '600' },
  emptyChatName: { fontStyle: 'italic', fontSize: 22, color: '#1A1A2E', fontWeight: '300' },
  emptyChatCode: { fontSize: 13, color: '#B39DDB', letterSpacing: 1 },
  emptyChatHint: { fontSize: 14, color: '#6B6B8A', fontStyle: 'italic', marginTop: 8 },

  timeStamp: { textAlign: 'center', fontSize: 11, color: 'rgba(107,107,138,0.5)', marginVertical: 8 },

  msgRow: { flexDirection: 'row', marginBottom: 4 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleMe: { backgroundColor: '#1A1A2E', borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: '#F0EFF8', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: '#1A1A2E', lineHeight: 21 },
  msgTextMe: { color: '#fff' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(107,107,138,0.08)', gap: 8, backgroundColor: '#FAFAF8' },
  inputWrap: { flex: 1, backgroundColor: '#F0EFF8', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  input: { fontSize: 15, color: '#1A1A2E', maxHeight: 100, padding: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  sendBtnDisabled: { backgroundColor: 'rgba(107,107,138,0.2)', shadowOpacity: 0, elevation: 0 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },
});