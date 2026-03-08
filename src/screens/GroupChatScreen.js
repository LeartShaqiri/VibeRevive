import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';

// Typing animation for group name — runs fresh every mount
function TypingTitle({ name }) {
  const [displayed, setDisplayed] = useState('');
  const [cursor,    setCursor]    = useState(true);
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    setDisplayed(''); setDone(false);
    let i = 0;
    const t = setInterval(() => {
      setDisplayed(name.slice(0, i + 1));
      i++;
      if (i >= name.length) { clearInterval(t); setDone(true); }
    }, 70);
    return () => clearInterval(t);
  }, [name]);

  useEffect(() => {
    if (done) return;
    const b = setInterval(() => setCursor(c => !c), 480);
    return () => clearInterval(b);
  }, [done]);

  return (
    <Text style={styles.headerName} numberOfLines={1}>
      {displayed}
      {!done && <Text style={{ opacity: cursor ? 1 : 0, color: '#B39DDB' }}>|</Text>}
    </Text>
  );
}

export default function GroupChatScreen({ navigation, route }) {
  const { groupId, groupName, groupImage, ownerId, token, displayName, profileImage } = route.params;

  const [messages,    setMessages]    = useState([]);
  const [members,     setMembers]     = useState([]);
  const [nonMembers,  setNonMembers]  = useState([]);
  const [group,       setGroup]       = useState(null);
  const [inputText,   setInputText]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Modals
  const [infoModal,   setInfoModal]   = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [inviteModal, setInviteModal] = useState(false);

  // Edit state
  const [editName,    setEditName]    = useState(groupName);
  const [editImage,   setEditImage]   = useState(groupImage || '');
  const [saving,      setSaving]      = useState(false);

  // Invite state
  const [inviteSelected, setInviteSelected] = useState([]);
  const [inviting,       setInviting]       = useState(false);

  const scrollRef = useRef(null);
  const pollRef   = useRef(null);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  const fetchAll = async () => {
    try {
      const data = await api.getGroupMessages(token, groupId);
      setMessages(data.messages   || []);
      setMembers(data.members     || []);
      setNonMembers(data.non_members || []);
      setGroup(data.group         || null);
      // figure out who current user is from members
      if (data.members) {
        const me = data.members.find(m => m.is_owner && data.group?.owner_id === m.id)
          || data.members[0];
        setCurrentUser(data.group);
      }
    } catch (err) {
      console.log('Group fetch error:', err.message);
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
      id: Date.now(), sender_id: 0, text,
      sent_at: new Date().toISOString(), is_me: true,
      is_system: false, sender_name: displayName, sender_image: profileImage || '',
    };
    setMessages(prev => [...prev, temp]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      await api.sendGroupMessage(token, groupId, text);
      await fetchAll();
    } catch (err) {
      console.log('Send error:', err.message);
    } finally {
      setSending(false);
    }
  };

  // ── Is current user the owner? ────────────────────────────────────
  const isOwner = group?.owner_id != null && members.some(m => m.is_owner && m.id === group?.owner_id)
    ? members.find(m => m.is_owner)?.id === members.find(m => m.is_owner)?.id
    : false;
  // Simpler: just check ownerId passed from route or group.owner_id
  const amOwner = (group?.owner_id != null)
    ? (ownerId != null ? group?.owner_id === ownerId : false)
    : false;
  // We need to know current user's own id — pass it or derive from members
  // Best approach: fetch /me once
  const [myId, setMyId] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const d = await api.me(token);
        setMyId(d.user.id);
      } catch {}
    })();
  }, []);

  const iAmOwner = myId != null && group?.owner_id === myId;

  // ── Delete group ──────────────────────────────────────────────────
  const handleDeleteGroup = () => {
    Alert.alert(
      '🗑 Delete group?',
      `This will permanently delete "${group?.name}" and remove all messages and members. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteGroup(token, groupId);
              navigation.reset({ index: 0, routes: [{ name: 'Home', params: { token, user: null } }] });
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // ── Leave group ───────────────────────────────────────────────────
  const handleLeaveGroup = () => {
    Alert.alert(
      '👋 Leave group?',
      `You'll be removed from "${group?.name}". You can rejoin if someone invites you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: async () => {
            try {
              await api.leaveGroup(token, groupId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // ── Save group edits ──────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editName.trim()) { Alert.alert('', 'Group name required'); return; }
    setSaving(true);
    try {
      await api.updateGroup(token, groupId, { name: editName.trim(), image: editImage });
      await fetchAll();
      setEditModal(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Pick edit image ───────────────────────────────────────────────
  const pickEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled) setEditImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  // ── Send invites ──────────────────────────────────────────────────
  const handleSendInvites = async () => {
    if (inviteSelected.length === 0) { Alert.alert('', 'Select at least one person'); return; }
    setInviting(true);
    try {
      const data = await api.inviteToGroup(token, groupId, inviteSelected);
      setInviteModal(false);
      setInviteSelected([]);
      Alert.alert('📨 Invites sent!', data.message);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setInviting(false);
    }
  };

  const formatTime = (t) => {
    if (!t) return '';
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const currentGroupImage = (group?.image || groupImage || '').trim();
  const currentGroupName  = group?.name || groupName;
  const groupInitials     = currentGroupName.slice(0, 2).toUpperCase();

  const openInfoModal = () => {
    setEditName(currentGroupName);
    setEditImage(currentGroupImage);
    setInfoModal(true);
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} onPress={openInfoModal} activeOpacity={0.8}>
          <View style={styles.headerAvatarWrap}>
            {currentGroupImage
              ? <Image source={{ uri: currentGroupImage }} style={styles.headerAvatarImg} resizeMode="cover" />
              : <View style={styles.headerAvatarFallback}>
                  <Text style={styles.headerAvatarText}>{groupInitials}</Text>
                </View>
            }
          </View>
          <View style={{ flex: 1 }}>
            <TypingTitle name={currentGroupName} />
            <Text style={styles.headerSub}>
              {members.length} member{members.length !== 1 ? 's' : ''} · tap to manage
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
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
            {messages.map((msg, i) => {
              if (msg.is_system) return (
                <View key={msg.id} style={styles.systemMsgWrap}>
                  <View style={styles.systemMsg}>
                    <Text style={styles.systemMsgText}>{msg.text}</Text>
                  </View>
                </View>
              );
              const showName = !msg.is_me && (i === 0 || messages[i-1]?.sender_id !== msg.sender_id || messages[i-1]?.is_system);
              const showTime = i === 0 || new Date(msg.sent_at) - new Date(messages[i-1]?.sent_at) > 5*60*1000;
              return (
                <View key={msg.id}>
                  {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
                  <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
                    {!msg.is_me && (
                      <View style={styles.msgAvatar}>
                        {msg.sender_image
                          ? <Image source={{ uri: msg.sender_image }} style={styles.msgAvatarImg} />
                          : <Text style={styles.msgAvatarText}>{msg.sender_name?.slice(0,1)}</Text>
                        }
                      </View>
                    )}
                    <View style={styles.msgContent}>
                      {showName && <Text style={styles.msgSenderName}>{msg.sender_name}</Text>}
                      <View style={[styles.msgBubble, msg.is_me ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                        <Text style={[styles.msgText, msg.is_me && styles.msgTextMe]}>{msg.text}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Message the group..."
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={inputText} onChangeText={setInputText}
              multiline maxLength={500} autoCorrect={false} blurOnSubmit={false}
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

      {/* ══ GROUP INFO / MANAGEMENT MODAL ══ */}
      <Modal visible={infoModal} transparent animationType="slide" onRequestClose={() => setInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoSheet}>
            <View style={styles.modalHandle} />

            {/* Group avatar */}
            <View style={styles.infoAvatarWrap}>
              {currentGroupImage
                ? <Image source={{ uri: currentGroupImage }} style={styles.infoAvatar} resizeMode="cover" />
                : <View style={styles.infoAvatarFallback}>
                    <Text style={styles.infoAvatarText}>{groupInitials}</Text>
                  </View>
              }
            </View>
            <Text style={styles.infoGroupName}>{currentGroupName}</Text>
            <Text style={styles.infoMemberCount}>{members.length} members</Text>

            {/* Owner actions */}
            {iAmOwner && (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setInfoModal(false); setEditModal(true); }}>
                  <Text style={styles.actionBtnIcon}>✏️</Text>
                  <Text style={styles.actionBtnText}>Edit group</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setInfoModal(false); setInviteModal(true); }}>
                  <Text style={styles.actionBtnIcon}>👤+</Text>
                  <Text style={styles.actionBtnText}>Invite</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => { setInfoModal(false); handleDeleteGroup(); }}>
                  <Text style={styles.actionBtnIcon}>🗑</Text>
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Member actions */}
            {!iAmOwner && myId != null && (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setInfoModal(false); setInviteModal(true); }}>
                  <Text style={styles.actionBtnIcon}>👤+</Text>
                  <Text style={styles.actionBtnText}>Invite</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => { setInfoModal(false); handleLeaveGroup(); }}>
                  <Text style={styles.actionBtnIcon}>👋</Text>
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Leave</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.infoDivider} />
            <Text style={styles.infoSectionLabel}>MEMBERS</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {members.map(m => {
                const mi = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                return (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      {m.profile_image
                        ? <Image source={{ uri: m.profile_image }} style={styles.memberAvatarImg} />
                        : <Text style={styles.memberAvatarText}>{mi}</Text>
                      }
                    </View>
                    <Text style={styles.memberName}>{m.name}</Text>
                    {m.is_owner && (
                      <View style={styles.ownerBadge}>
                        <Text style={styles.ownerBadgeText}>👑 Owner</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setInfoModal(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ EDIT GROUP MODAL (owner only) ══ */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.editSheetTitle}>Edit Vibe Squad</Text>

            {/* Image picker */}
            <TouchableOpacity style={styles.editAvatarWrap} onPress={pickEditImage} activeOpacity={0.85}>
              {editImage
                ? <Image source={{ uri: editImage }} style={styles.editAvatar} resizeMode="cover" />
                : <View style={styles.editAvatarFallback}>
                    <Text style={styles.editAvatarText}>{editName.slice(0,2).toUpperCase() || 'VS'}</Text>
                  </View>
              }
              <View style={styles.editAvatarCameraBadge}>
                <Text style={{ fontSize: 14 }}>📷</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.editLabel}>GROUP NAME</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Group name"
              placeholderTextColor="rgba(107,107,138,0.4)"
              autoCapitalize="words"
              maxLength={40}
            />

            <TouchableOpacity
              style={[styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={handleSaveEdit} activeOpacity={0.85} disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Save changes ✦</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setEditModal(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ INVITE MODAL ══ */}
      <Modal visible={inviteModal} transparent animationType="slide" onRequestClose={() => setInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.editSheetTitle}>Invite to Vibe Squad</Text>
            <Text style={styles.editSheetSub}>
              {nonMembers.length === 0 ? 'All your contacts are already in this group!' : 'Select contacts to invite'}
            </Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {nonMembers.map(nm => {
                const ni = nm.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                const sel = inviteSelected.includes(nm.id);
                return (
                  <TouchableOpacity
                    key={nm.id}
                    style={[styles.invitePersonRow, sel && styles.invitePersonRowSel]}
                    onPress={() => setInviteSelected(prev => sel ? prev.filter(x => x !== nm.id) : [...prev, nm.id])}
                    activeOpacity={0.75}
                  >
                    <View style={styles.invitePersonAvatar}>
                      {nm.profile_image
                        ? <Image source={{ uri: nm.profile_image }} style={styles.invitePersonAvatarImg} />
                        : <Text style={styles.invitePersonAvatarText}>{ni}</Text>
                      }
                    </View>
                    <Text style={styles.invitePersonName}>{nm.name}</Text>
                    <View style={[styles.checkCircle, sel && styles.checkCircleSel]}>
                      {sel && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {nonMembers.length > 0 && (
              <TouchableOpacity
                style={[styles.btnPrimary, { marginTop: 16 }, (inviting || inviteSelected.length === 0) && styles.btnDisabled]}
                onPress={handleSendInvites} activeOpacity={0.85}
                disabled={inviting || inviteSelected.length === 0}
              >
                {inviting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>
                      Send {inviteSelected.length > 0 ? `${inviteSelected.length} ` : ''}invite{inviteSelected.length !== 1 ? 's' : ''} 📨
                    </Text>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setInviteModal(false); setInviteSelected([]); }}>
              <Text style={styles.closeBtnText}>Cancel</Text>
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
  headerAvatarWrap: { width:42, height:42, borderRadius:12, overflow:'hidden', backgroundColor:'#7B5EA7' },
  headerAvatarImg: { width:42, height:42 },
  headerAvatarFallback: { width:42, height:42, alignItems:'center', justifyContent:'center' },
  headerAvatarText: { color:'#fff', fontSize:15, fontWeight:'700' },
  headerName: { fontSize:16, color:'#1A1A2E', fontWeight:'600', fontStyle:'italic' },
  headerSub: { fontSize:10, color:'#B39DDB', marginTop:1, fontStyle:'italic' },
  loadingWrap: { flex:1, alignItems:'center', justifyContent:'center' },
  messageList: { flex:1 },
  messageListContent: { padding:16, paddingBottom:8 },
  systemMsgWrap: { alignItems:'center', marginVertical:8 },
  systemMsg: { backgroundColor:'rgba(123,94,167,0.1)', borderRadius:20, paddingHorizontal:16, paddingVertical:7, borderWidth:1, borderColor:'rgba(123,94,167,0.15)' },
  systemMsgText: { fontSize:13, color:'#7B5EA7', fontStyle:'italic', textAlign:'center' },
  timeStamp: { textAlign:'center', fontSize:11, color:'rgba(107,107,138,0.5)', marginVertical:8 },
  msgRow: { flexDirection:'row', alignItems:'flex-end', marginBottom:4, gap:6 },
  msgRowMe: { justifyContent:'flex-end' },
  msgAvatar: { width:28, height:28, borderRadius:14, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden', marginBottom:2 },
  msgAvatarImg: { width:28, height:28, borderRadius:14 },
  msgAvatarText: { color:'#fff', fontSize:12, fontWeight:'600' },
  msgContent: { maxWidth:'72%' },
  msgSenderName: { fontSize:11, color:'#B39DDB', marginBottom:3, marginLeft:4 },
  msgBubble: { borderRadius:18, paddingHorizontal:14, paddingVertical:10 },
  msgBubbleMe: { backgroundColor:'#1A1A2E', borderBottomRightRadius:4 },
  msgBubbleThem: { backgroundColor:'#F0EFF8', borderBottomLeftRadius:4 },
  msgText: { fontSize:15, color:'#1A1A2E', lineHeight:21 },
  msgTextMe: { color:'#fff' },
  inputBar: { flexDirection:'row', alignItems:'flex-end', paddingHorizontal:12, paddingVertical:10, borderTopWidth:1, borderTopColor:'rgba(107,107,138,0.08)', gap:8, backgroundColor:'#FAFAF8' },
  inputWrap: { flex:1, backgroundColor:'#F0EFF8', borderRadius:22, paddingHorizontal:16, paddingVertical:10, minHeight:44, justifyContent:'center' },
  input: { fontSize:15, color:'#1A1A2E', maxHeight:100, padding:0 },
  sendBtn: { width:44, height:44, borderRadius:22, backgroundColor:'#1A1A2E', alignItems:'center', justifyContent:'center', shadowColor:'#1A1A2E', shadowOffset:{width:0,height:3}, shadowOpacity:0.2, shadowRadius:6, elevation:3 },
  sendBtnDisabled: { backgroundColor:'rgba(107,107,138,0.2)', shadowOpacity:0, elevation:0 },
  sendBtnText: { color:'#fff', fontSize:20, fontWeight:'700', lineHeight:24 },

  // ── Info modal ──
  modalOverlay: { flex:1, backgroundColor:'rgba(26,26,46,0.5)', justifyContent:'flex-end' },
  infoSheet: { backgroundColor:'#FAFAF8', borderTopLeftRadius:32, borderTopRightRadius:32, padding:24, paddingBottom:48, maxHeight:'90%' },
  editSheet: { backgroundColor:'#FAFAF8', borderTopLeftRadius:32, borderTopRightRadius:32, padding:28, paddingBottom:48 },
  modalHandle: { width:40, height:4, borderRadius:2, backgroundColor:'rgba(107,107,138,0.2)', alignSelf:'center', marginBottom:20 },
  infoAvatarWrap: { alignItems:'center', marginBottom:10 },
  infoAvatar: { width:72, height:72, borderRadius:20 },
  infoAvatarFallback: { width:72, height:72, borderRadius:20, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center' },
  infoAvatarText: { color:'#fff', fontSize:24, fontWeight:'700' },
  infoGroupName: { fontStyle:'italic', fontSize:22, color:'#1A1A2E', fontWeight:'300', textAlign:'center', marginBottom:3 },
  infoMemberCount: { fontSize:13, color:'#B39DDB', textAlign:'center', marginBottom:16 },

  actionsRow: { flexDirection:'row', gap:10, justifyContent:'center', marginBottom:16 },
  actionBtn: { alignItems:'center', backgroundColor:'#F0EFF8', borderRadius:16, paddingVertical:12, paddingHorizontal:18, gap:4, minWidth:80 },
  actionBtnDanger: { backgroundColor:'rgba(239,68,68,0.08)' },
  actionBtnIcon: { fontSize:20 },
  actionBtnText: { fontSize:12, color:'#1A1A2E', fontWeight:'500' },

  infoDivider: { height:1, backgroundColor:'rgba(107,107,138,0.1)', marginBottom:14 },
  infoSectionLabel: { fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#6B6B8A', fontWeight:'600', marginBottom:10 },
  memberRow: { flexDirection:'row', alignItems:'center', paddingVertical:10, gap:12, borderBottomWidth:1, borderBottomColor:'rgba(107,107,138,0.06)' },
  memberAvatar: { width:38, height:38, borderRadius:19, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  memberAvatarImg: { width:38, height:38, borderRadius:19 },
  memberAvatarText: { color:'#fff', fontSize:13, fontWeight:'600' },
  memberName: { flex:1, fontSize:15, color:'#1A1A2E' },
  ownerBadge: { backgroundColor:'rgba(255,215,0,0.15)', borderRadius:10, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:'rgba(255,215,0,0.4)' },
  ownerBadgeText: { fontSize:11, color:'#B8860B', fontWeight:'600' },
  closeBtn: { alignItems:'center', paddingVertical:12, marginTop:4 },
  closeBtnText: { fontSize:15, color:'#6B6B8A', fontStyle:'italic' },

  // ── Edit modal ──
  editSheetTitle: { fontStyle:'italic', fontSize:24, color:'#1A1A2E', fontWeight:'300', textAlign:'center', marginBottom:4 },
  editSheetSub: { fontSize:13, color:'#6B6B8A', textAlign:'center', marginBottom:20, fontStyle:'italic' },
  editAvatarWrap: { alignSelf:'center', position:'relative', marginBottom:20 },
  editAvatar: { width:80, height:80, borderRadius:20 },
  editAvatarFallback: { width:80, height:80, borderRadius:20, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center' },
  editAvatarText: { color:'#fff', fontSize:26, fontWeight:'700' },
  editAvatarCameraBadge: { position:'absolute', bottom:-4, right:-4, width:28, height:28, borderRadius:14, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.1, shadowRadius:4, elevation:3 },
  editLabel: { fontSize:11, letterSpacing:0.9, textTransform:'uppercase', color:'#6B6B8A', marginBottom:6, marginLeft:2, fontWeight:'500' },
  editInput: { backgroundColor:'#F0EFF8', borderRadius:14, borderWidth:1.5, borderColor:'transparent', padding:14, fontSize:17, color:'#1A1A2E', fontStyle:'italic', marginBottom:20 },

  // ── Invite modal ──
  invitePersonRow: { flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:4, borderRadius:14, marginBottom:2, gap:12 },
  invitePersonRowSel: { backgroundColor:'rgba(123,94,167,0.07)' },
  invitePersonAvatar: { width:44, height:44, borderRadius:22, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  invitePersonAvatarImg: { width:44, height:44, borderRadius:22 },
  invitePersonAvatarText: { color:'#fff', fontSize:15, fontWeight:'600' },
  invitePersonName: { flex:1, fontSize:15, color:'#1A1A2E' },
  checkCircle: { width:24, height:24, borderRadius:12, borderWidth:2, borderColor:'rgba(107,107,138,0.3)', alignItems:'center', justifyContent:'center' },
  checkCircleSel: { backgroundColor:'#7B5EA7', borderColor:'#7B5EA7' },
  checkMark: { color:'#fff', fontSize:13, fontWeight:'700' },

  btnPrimary: { backgroundColor:'#1A1A2E', borderRadius:16, paddingVertical:16, alignItems:'center', shadowColor:'#1A1A2E', shadowOffset:{width:0,height:6}, shadowOpacity:0.22, shadowRadius:14, elevation:5 },
  btnPrimaryText: { color:'#fff', fontSize:16, fontWeight:'500', letterSpacing:0.3 },
  btnDisabled: { backgroundColor:'rgba(107,107,138,0.2)', shadowOpacity:0, elevation:0 },
});