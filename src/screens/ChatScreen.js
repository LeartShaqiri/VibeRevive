import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

const AVATAR_BORDERS = [
  { id: 'none',        borderColor: 'transparent', shadowColor: 'transparent' },
  { id: 'glow_blue',   borderColor: '#00D4FF',     shadowColor: '#00D4FF' },
  { id: 'glow_pink',   borderColor: '#FF69B4',     shadowColor: '#FF69B4' },
  { id: 'glow_purple', borderColor: '#7B5EA7',     shadowColor: '#7B5EA7' },
  { id: 'glow_gold',   borderColor: '#FFD700',     shadowColor: '#FFD700' },
];

export default function ChatScreen({ navigation, route }) {
  const {
    contactId,
    contactName,
    vibeCode,
    token,
    displayName,
    profileImage:   contactProfileImage,
    profileBorder:  contactProfileBorder,
  } = route.params;

  const [messages,      setMessages]      = useState([]);
  const [inputText,     setInputText]     = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [profileModal,  setProfileModal]  = useState(false);
  const [contactBio,    setContactBio]    = useState(route.params.bio || '');

  const scrollRef = useRef(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pollRef   = useRef(null);

  const contactBorder = AVATAR_BORDERS.find(b => b.id === (contactProfileBorder || 'none'));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  const fetchMessages = async () => {
    try {
      const data = await api.getMessages(token, contactId);
      setMessages(data.messages || []);
    } catch (err) {
      console.log('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    setSending(true);

    const tempMsg = {
      id:          Date.now(),
      text,
      sent_at:     new Date().toISOString(),
      is_me:       true,
      sender_name: displayName,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await api.sendMessage(token, contactId, text);
      await fetchMessages();
    } catch (err) {
      console.log('Send error:', err.message);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (t) => {
    if (!t) return '';
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const contactInitials = contactName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        {/* Tapping the name/avatar opens profile modal */}
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setProfileModal(true)}
          activeOpacity={0.75}
        >
          <View style={[
            styles.headerAvatar,
            contactBorder?.id !== 'none' && {
              borderWidth: 2.5,
              borderColor: contactBorder?.borderColor,
              shadowColor: contactBorder?.shadowColor,
              shadowOpacity: 0.6,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
            }
          ]}>
            {contactProfileImage
              ? <Image source={{ uri: contactProfileImage }} style={styles.headerAvatarImg} />
              : <Text style={styles.headerAvatarText}>{contactInitials}</Text>
            }
          </View>
          <View>
            <Text style={styles.headerName}>{contactName}</Text>
            <Text style={styles.headerHint}>tap to view profile</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                <View style={[
                  styles.emptyChatAvatar,
                  contactBorder?.id !== 'none' && {
                    borderWidth: 3,
                    borderColor: contactBorder?.borderColor,
                    shadowColor: contactBorder?.shadowColor,
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                  }
                ]}>
                  {contactProfileImage
                    ? <Image source={{ uri: contactProfileImage }} style={styles.emptyChatAvatarImg} />
                    : <Text style={styles.emptyChatAvatarText}>{contactInitials}</Text>
                  }
                </View>
                <Text style={styles.emptyChatName}>{contactName}</Text>
                <Text style={styles.emptyChatCode}>{vibeCode}</Text>
                <Text style={styles.emptyChatHint}>Say hi to start the vibe! 👋</Text>
              </View>
            ) : (
              messages.map((msg, i) => {
                const showTime = i === 0 ||
                  new Date(messages[i].sent_at) - new Date(messages[i - 1]?.sent_at) > 5 * 60 * 1000;
                return (
                  <View key={msg.id}>
                    {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
                    <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
                      {!msg.is_me && (
                        <View style={[styles.msgAvatar, contactBorder?.id !== 'none' && {
                          borderWidth: 1.5, borderColor: contactBorder?.borderColor
                        }]}>
                          {contactProfileImage
                            ? <Image source={{ uri: contactProfileImage }} style={styles.msgAvatarImg} />
                            : <Text style={styles.msgAvatarText}>{contactInitials}</Text>
                          }
                        </View>
                      )}
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

      {/* ── CONTACT PROFILE MODAL ── */}
      <Modal visible={profileModal} transparent animationType="slide" onRequestClose={() => setProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Big avatar */}
            <View style={styles.modalAvatarWrap}>
              <View style={[
                styles.modalAvatar,
                contactBorder?.id !== 'none' && {
                  borderWidth: 4,
                  borderColor: contactBorder?.borderColor,
                  shadowColor: contactBorder?.shadowColor,
                  shadowOpacity: 0.6,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 12,
                }
              ]}>
                {contactProfileImage
                  ? <Image source={{ uri: contactProfileImage }} style={styles.modalAvatarImg} />
                  : <Text style={styles.modalAvatarInitials}>{contactInitials}</Text>
                }
              </View>
            </View>

            {/* Name */}
            <Text style={styles.modalName}>{contactName}</Text>

            {/* Vibe code */}
            <View style={styles.modalVibeCodeRow}>
              <Text style={styles.modalVibeCodeLabel}>VIBE CODE</Text>
              <Text style={styles.modalVibeCodeValue}>{vibeCode}</Text>
            </View>

            {/* Bio */}
            {contactBio ? (
              <View style={styles.modalBioBox}>
                <Text style={styles.modalBioText}>"{contactBio}"</Text>
              </View>
            ) : (
              <Text style={styles.modalNoBio}>No bio yet</Text>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setProfileModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(107,107,138,0.08)', backgroundColor: '#FAFAF8', gap: 10 },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A2E' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerName: { fontSize: 16, color: '#1A1A2E', fontWeight: '600' },
  headerHint: { fontSize: 10, color: '#B39DDB', marginTop: 1, fontStyle: 'italic' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },

  emptyChat: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyChatAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  emptyChatAvatarImg: { width: 80, height: 80, borderRadius: 40 },
  emptyChatAvatarText: { color: '#fff', fontSize: 28, fontWeight: '600' },
  emptyChatName: { fontStyle: 'italic', fontSize: 22, color: '#1A1A2E', fontWeight: '300' },
  emptyChatCode: { fontSize: 13, color: '#B39DDB', letterSpacing: 1 },
  emptyChatHint: { fontSize: 14, color: '#6B6B8A', fontStyle: 'italic', marginTop: 8 },

  timeStamp: { textAlign: 'center', fontSize: 11, color: 'rgba(107,107,138,0.5)', marginVertical: 8 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 2 },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarText: { color: '#fff', fontSize: 10, fontWeight: '600' },
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

  // Profile modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,46,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FAFAF8', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 48, alignItems: 'center' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(107,107,138,0.2)', marginBottom: 24 },
  modalAvatarWrap: { marginBottom: 16 },
  modalAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalAvatarImg: { width: 110, height: 110, borderRadius: 55 },
  modalAvatarInitials: { color: '#fff', fontSize: 36, fontWeight: '600' },
  modalName: { fontStyle: 'italic', fontSize: 28, color: '#1A1A2E', fontWeight: '300', marginBottom: 12 },
  modalVibeCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  modalVibeCodeLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: '#B39DDB' },
  modalVibeCodeValue: { fontSize: 16, color: '#7B5EA7', fontWeight: '700', letterSpacing: 2 },
  modalBioBox: { backgroundColor: '#F0EFF8', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 24, width: '100%' },
  modalBioText: { fontStyle: 'italic', fontSize: 15, color: '#6B6B8A', textAlign: 'center', lineHeight: 22 },
  modalNoBio: { fontSize: 14, color: 'rgba(107,107,138,0.4)', fontStyle: 'italic', marginBottom: 24 },
  modalCloseBtn: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});