import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

export default function ChatScreen({ navigation, route }) {
  const {
    contactId, contactName, vibeCode, profileImage, profileBorder,
    bio, vibeTags, mainVibe, token, displayName,
  } = route.params;

  const [messages,     setMessages]     = useState([]);
  const [inputText,    setInputText]    = useState('');
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  const scrollRef = useRef(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pollRef   = useRef(null);

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
    const temp = {
      id: Date.now(), sender_id: -1, text,
      sent_at: new Date().toISOString(), is_me: true,
      msg_type: 'text', group_invite: null,
    };
    setMessages(prev => [...prev, temp]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      await api.sendMessage(token, contactId, text);
      await fetchMessages();
    } catch (err) {
      console.log('Send error:', err.message);
    } finally {
      setSending(false);
    }
  };

  const handleGroupInviteRespond = async (inviteId, action, groupName, groupId, groupImage) => {
    setRespondingId(inviteId);
    try {
      await api.respondToGroupInvite(token, inviteId, action);
      await fetchMessages();
      if (action === 'accept') {
        Alert.alert('🎉 Joined!', `You\'re now in ${groupName}!`, [
          {
            text: 'Open group', onPress: () => navigation.navigate('GroupChat', {
              groupId, groupName, groupImage: groupImage || '',
              ownerId: null, token, displayName,
              profileImage: profileImage || '',
            }),
          },
          { text: 'Later', style: 'cancel' },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRespondingId(null);
    }
  };

  const formatTime = (t) => {
    if (!t) return '';
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const tags     = vibeTags ? vibeTags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const initials = contactName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const renderMessage = (msg, i) => {
    const showTime = i === 0 ||
      new Date(msg.sent_at) - new Date(messages[i - 1]?.sent_at) > 5 * 60 * 1000;

    // ── GROUP INVITE CARD ──
    if (msg.msg_type === 'group_invite' && msg.group_invite) {
      const inv       = msg.group_invite;
      const isPending = inv.status === 'pending';
      const accepted  = inv.status === 'accepted';
      const isDeleted = inv.status === 'deleted' || inv.group_id === null;
      const gi        = (inv.group_name || 'GR').slice(0, 2).toUpperCase();
      const isLoading = respondingId === inv.invite_id;

      return (
        <View key={msg.id}>
          {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
          <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
            {!msg.is_me && (
              <View style={styles.msgAvatar}>
                {profileImage
                  ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} />
                  : <Text style={styles.msgAvatarText}>{initials.slice(0, 1)}</Text>
                }
              </View>
            )}

            {/* Compact invite card */}
            <View style={styles.inviteCard}>
              <View style={styles.inviteTop}>
                {/* Group image */}
                <View style={styles.inviteAvatar}>
                  {inv.group_image
                    ? <Image source={{ uri: inv.group_image }} style={styles.inviteAvatarImg} resizeMode="cover" />
                    : <Text style={styles.inviteAvatarText}>{gi}</Text>
                  }
                </View>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteTitle} numberOfLines={1}>
                    {msg.is_me ? 'You invited them to' : 'You\'re invited to'}
                  </Text>
                  <Text style={styles.inviteGroupName} numberOfLines={1}>{inv.group_name}</Text>
                </View>
              </View>

              {/* Action area */}
              {isDeleted ? (
                <View style={styles.inviteStatusRow}>
                  <Text style={styles.inviteStatusText}>🗑 This group no longer exists</Text>
                </View>
              ) : msg.is_me ? (
                <View style={styles.inviteStatusRow}>
                  <Text style={styles.inviteStatusText}>
                    {accepted ? '✓ They joined!' : inv.status === 'declined' ? '✕ Declined' : '📨 Pending'}
                  </Text>
                </View>
              ) : isPending ? (
                <View style={styles.inviteBtnRow}>
                  <TouchableOpacity
                    style={[styles.joinBtn, isLoading && { opacity: 0.6 }]}
                    onPress={() => handleGroupInviteRespond(inv.invite_id, 'accept', inv.group_name, inv.group_id, inv.group_image)}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.joinBtnText}>✓  Join</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.declineBtn, isLoading && { opacity: 0.6 }]}
                    onPress={() => handleGroupInviteRespond(inv.invite_id, 'decline', inv.group_name, inv.group_id, inv.group_image)}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.declineBtnText}>✕  Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inviteStatusRow}>
                  <Text style={[styles.inviteStatusText, accepted && { color: '#22C55E' }]}>
                    {accepted ? '✓ Joined!' : '✕ Declined'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      );
    }

    // ── NORMAL MESSAGE ──
    return (
      <View key={msg.id}>
        {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
        <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
          {!msg.is_me && (
            <View style={styles.msgAvatar}>
              {profileImage
                ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} />
                : <Text style={styles.msgAvatarText}>{initials.slice(0, 1)}</Text>
              }
            </View>
          )}
          <View style={[styles.msgBubble, msg.is_me ? styles.msgBubbleMe : styles.msgBubbleThem]}>
            <Text style={[styles.msgText, msg.is_me && styles.msgTextMe]}>{msg.text}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => setProfileModal(true)} activeOpacity={0.8}>
          <View style={styles.headerAvatar}>
            {profileImage
              ? <Image source={{ uri: profileImage }} style={styles.headerAvatarImg} />
              : <Text style={styles.headerAvatarText}>{initials}</Text>
            }
          </View>
          <View>
            <Text style={styles.headerName}>{contactName}</Text>
            <Text style={styles.headerSub}>{vibeCode}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#7B5EA7" /></View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 && (
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatAvatar}>
                  {profileImage
                    ? <Image source={{ uri: profileImage }} style={styles.emptyChatAvatarImg} />
                    : <Text style={styles.emptyChatAvatarText}>{initials}</Text>
                  }
                </View>
                <Text style={styles.emptyChatName}>{contactName}</Text>
                {bio ? <Text style={styles.emptyChatBio}>{bio}</Text> : null}
                <Text style={styles.emptyChatHint}>Say hi! 👋</Text>
              </View>
            )}
            {messages.map((msg, i) => renderMessage(msg, i))}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder={`Message ${contactName.split(' ')[0]}...`}
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={inputText}
              onChangeText={setInputText}
              multiline maxLength={500}
              autoCorrect={false}
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage} activeOpacity={0.85} disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={profileModal} transparent animationType="slide" onRequestClose={() => setProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.profileSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.profileAvatarWrap}>
              <View style={styles.profileAvatar}>
                {profileImage
                  ? <Image source={{ uri: profileImage }} style={styles.profileAvatarImg} />
                  : <Text style={styles.profileAvatarText}>{initials}</Text>
                }
              </View>
            </View>
            <Text style={styles.profileName}>{contactName}</Text>
            <Text style={styles.profileCode}>{vibeCode}</Text>
            {bio ? <Text style={styles.profileBio}>{bio}</Text> : null}
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map((tag, i) => (
                  <View key={i} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            {mainVibe ? (
              <View style={styles.mainVibeRow}>
                <Text style={styles.mainVibeLabel}>MAIN VIBE</Text>
                <Text style={styles.mainVibeValue}>{mainVibe}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setProfileModal(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1, backgroundColor:'#FAFAF8' },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(107,107,138,0.08)', backgroundColor:'#FAFAF8', gap:10 },
  backBtn: { padding:4 },
  backText: { fontSize:22, color:'#1A1A2E' },
  headerCenter: { flex:1, flexDirection:'row', alignItems:'center', gap:10 },
  headerAvatar: { width:40, height:40, borderRadius:20, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  headerAvatarImg: { width:40, height:40, borderRadius:20 },
  headerAvatarText: { color:'#fff', fontSize:14, fontWeight:'600' },
  headerName: { fontSize:16, color:'#1A1A2E', fontWeight:'600' },
  headerSub: { fontSize:11, color:'#B39DDB', letterSpacing:0.5 },
  loadingWrap: { flex:1, alignItems:'center', justifyContent:'center' },
  messageList: { flex:1 },
  messageListContent: { padding:16, paddingBottom:8 },
  emptyChat: { alignItems:'center', paddingTop:40, paddingBottom:20, gap:8 },
  emptyChatAvatar: { width:72, height:72, borderRadius:36, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden', marginBottom:4 },
  emptyChatAvatarImg: { width:72, height:72, borderRadius:36 },
  emptyChatAvatarText: { color:'#fff', fontSize:24, fontWeight:'600' },
  emptyChatName: { fontSize:20, color:'#1A1A2E', fontStyle:'italic', fontWeight:'300' },
  emptyChatBio: { fontSize:13, color:'#6B6B8A', textAlign:'center', maxWidth:220, fontStyle:'italic' },
  emptyChatHint: { fontSize:13, color:'#B39DDB', marginTop:4 },
  timeStamp: { textAlign:'center', fontSize:11, color:'rgba(107,107,138,0.5)', marginVertical:8 },
  msgRow: { flexDirection:'row', alignItems:'flex-end', marginBottom:6, gap:6 },
  msgRowMe: { justifyContent:'flex-end' },
  msgAvatar: { width:28, height:28, borderRadius:14, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden', marginBottom:2 },
  msgAvatarImg: { width:28, height:28, borderRadius:14 },
  msgAvatarText: { color:'#fff', fontSize:12, fontWeight:'600' },
  msgBubble: { maxWidth:'72%', borderRadius:18, paddingHorizontal:14, paddingVertical:10 },
  msgBubbleMe: { backgroundColor:'#1A1A2E', borderBottomRightRadius:4 },
  msgBubbleThem: { backgroundColor:'#F0EFF8', borderBottomLeftRadius:4 },
  msgText: { fontSize:15, color:'#1A1A2E', lineHeight:21 },
  msgTextMe: { color:'#fff' },

  // ── Invite card — compact horizontal layout ──
  inviteCard: {
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(123,94,167,0.2)',
    overflow: 'hidden',
    shadowColor: '#7B5EA7',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  inviteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  inviteAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7B5EA7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  inviteAvatarImg: { width: 44, height: 44 },
  inviteAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  inviteInfo: { flex: 1 },
  inviteTitle: { fontSize: 11, color: '#6B6B8A', marginBottom: 2 },
  inviteGroupName: { fontSize: 15, color: '#1A1A2E', fontWeight: '600' },

  // Buttons row
  inviteBtnRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(107,107,138,0.1)',
    height: 42,
  },
  joinBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  declineBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Status after responding
  inviteStatusRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(107,107,138,0.1)',
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(107,107,138,0.03)',
  },
  inviteStatusText: { fontSize: 12, color: '#6B6B8A', fontStyle: 'italic' },

  inputBar: { flexDirection:'row', alignItems:'flex-end', paddingHorizontal:12, paddingVertical:10, borderTopWidth:1, borderTopColor:'rgba(107,107,138,0.08)', gap:8, backgroundColor:'#FAFAF8' },
  inputWrap: { flex:1, backgroundColor:'#F0EFF8', borderRadius:22, paddingHorizontal:16, paddingVertical:10, minHeight:44, justifyContent:'center' },
  input: { fontSize:15, color:'#1A1A2E', maxHeight:100, padding:0 },
  sendBtn: { width:44, height:44, borderRadius:22, backgroundColor:'#1A1A2E', alignItems:'center', justifyContent:'center', shadowColor:'#1A1A2E', shadowOffset:{width:0,height:3}, shadowOpacity:0.2, shadowRadius:6, elevation:3 },
  sendBtnDisabled: { backgroundColor:'rgba(107,107,138,0.2)', shadowOpacity:0, elevation:0 },
  sendBtnText: { color:'#fff', fontSize:20, fontWeight:'700', lineHeight:24 },

  modalOverlay: { flex:1, backgroundColor:'rgba(26,26,46,0.5)', justifyContent:'flex-end' },
  profileSheet: { backgroundColor:'#FAFAF8', borderTopLeftRadius:32, borderTopRightRadius:32, padding:28, paddingBottom:48, alignItems:'center' },
  modalHandle: { width:40, height:4, borderRadius:2, backgroundColor:'rgba(107,107,138,0.2)', marginBottom:20 },
  profileAvatarWrap: { marginBottom:12 },
  profileAvatar: { width:80, height:80, borderRadius:40, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  profileAvatarImg: { width:80, height:80, borderRadius:40 },
  profileAvatarText: { color:'#fff', fontSize:28, fontWeight:'600' },
  profileName: { fontSize:24, color:'#1A1A2E', fontStyle:'italic', fontWeight:'300', marginBottom:4 },
  profileCode: { fontSize:13, color:'#B39DDB', letterSpacing:1.5, marginBottom:12 },
  profileBio: { fontSize:14, color:'#6B6B8A', textAlign:'center', maxWidth:260, fontStyle:'italic', lineHeight:20, marginBottom:12 },
  tagsRow: { flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:12 },
  tagChip: { backgroundColor:'rgba(123,94,167,0.1)', borderRadius:20, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(123,94,167,0.2)' },
  tagChipText: { fontSize:13, color:'#7B5EA7' },
  mainVibeRow: { alignItems:'center', marginBottom:16, gap:4 },
  mainVibeLabel: { fontSize:10, letterSpacing:1.2, textTransform:'uppercase', color:'#B39DDB' },
  mainVibeValue: { fontSize:16, color:'#1A1A2E', fontStyle:'italic' },
  closeBtn: { paddingVertical:12, paddingHorizontal:32 },
  closeBtnText: { fontSize:15, color:'#6B6B8A', fontStyle:'italic' },
});