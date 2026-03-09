import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Modal, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { api } from '../api';

const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_y31kFrBDsLNDsHl5Uf7NZM'; // free Tenor v2 key
const TENOR_URL     = 'https://tenor.googleapis.com/v2';

export default function ChatScreen({ navigation, route }) {
  const {
    contactId, contactName, vibeCode, profileImage, profileBorder,
    bio, vibeTags, mainVibe, token, displayName,
  } = route.params;

  const [messages,      setMessages]      = useState([]);
  const [inputText,     setInputText]     = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [respondingId,  setRespondingId]  = useState(null);

  // Nickname (only local + saved to backend)
  const [nickname,      setNickname]      = useState('');
  const displayContactName = nickname.trim() || contactName;

  // Chat background
  const [chatBg,        setChatBg]        = useState(null);

  // Modals
  const [infoModal,     setInfoModal]     = useState(false);
  const [nicknameModal, setNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [gifModal,      setGifModal]      = useState(false);
  const [gifSearch,     setGifSearch]     = useState('');
  const [gifs,          setGifs]          = useState([]);
  const [gifLoading,    setGifLoading]    = useState(false);

  // Voice recording
  const [recording,     setRecording]     = useState(null);
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordTimerRef  = useRef(null);

  // Playback
  const [playingId,     setPlayingId]     = useState(null);
  const soundRef        = useRef(null);

  const scrollRef  = useRef(null);
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const pollRef    = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      clearInterval(pollRef.current);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const data = await api.getMessages(token, contactId);
      setMessages(data.messages || []);
      // Load nickname if stored
      if (data.nickname !== undefined) setNickname(data.nickname || '');
    } catch (err) {
      console.log('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Send text ──────────────────────────────────────────────────────
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

  // ── Send image ─────────────────────────────────────────────────────
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 0.6, base64: true,
    });
    if (!result.canceled) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSending(true);
      const temp = {
        id: Date.now(), sender_id: -1, text: b64,
        sent_at: new Date().toISOString(), is_me: true,
        msg_type: 'image', group_invite: null,
      };
      setMessages(prev => [...prev, temp]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      try {
        await api.sendMessage(token, contactId, b64, 'image');
        await fetchMessages();
      } catch (err) { console.log('Image send error:', err.message); }
      finally { setSending(false); }
    }
  };

  // ── GIF search ─────────────────────────────────────────────────────
  const searchGifs = async (q) => {
    setGifLoading(true);
    try {
      const query = q || 'trending';
      const endpoint = q
        ? `${TENOR_URL}/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif`
        : `${TENOR_URL}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`;
      const res  = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) { console.log('GIF error:', err.message); }
    finally { setGifLoading(false); }
  };

  const openGifModal = () => {
    setGifModal(true);
    searchGifs('');
  };

  const sendGif = async (gif) => {
    const url = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url || '';
    if (!url) return;
    setGifModal(false);
    setSending(true);
    const temp = {
      id: Date.now(), sender_id: -1, text: url,
      sent_at: new Date().toISOString(), is_me: true,
      msg_type: 'gif', group_invite: null,
    };
    setMessages(prev => [...prev, temp]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      await api.sendMessage(token, contactId, url, 'gif');
      await fetchMessages();
    } catch (err) { console.log('GIF send error:', err.message); }
    finally { setSending(false); }
  };

  // ── Voice recording ────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow microphone access.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { Alert.alert('Error', 'Could not start recording'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      // Convert to base64
      const { FileSystem } = await import('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const audioData = `data:audio/m4a;base64,${base64}`;
      setSending(true);
      const temp = {
        id: Date.now(), sender_id: -1, text: audioData,
        sent_at: new Date().toISOString(), is_me: true,
        msg_type: 'voice', group_invite: null,
        duration: recordingTime,
      };
      setMessages(prev => [...prev, temp]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      try {
        await api.sendMessage(token, contactId, audioData, 'voice');
        await fetchMessages();
      } catch (err) { console.log('Voice send error:', err.message); }
      finally { setSending(false); }
    } catch (err) { Alert.alert('Error', 'Could not save recording'); }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    try { await recording.stopAndUnloadAsync(); } catch {}
    setRecording(null);
    setRecordingTime(0);
  };

  const playVoice = async (msg) => {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      if (playingId === msg.id) { setPlayingId(null); return; }
      setPlayingId(msg.id);
      const { sound } = await Audio.Sound.createAsync({ uri: msg.text });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) { setPlayingId(null); sound.unloadAsync(); }
      });
    } catch (err) { setPlayingId(null); Alert.alert('Error', 'Could not play audio'); }
  };

  // ── Details actions ────────────────────────────────────────────────
  const handleSaveNickname = async () => {
    setNickname(nicknameInput.trim());
    setNicknameModal(false);
    try { await api.setNickname(token, contactId, nicknameInput.trim()); } catch {}
  };

  const handleBlock = () => {
    Alert.alert(
      '🚫 Block user?',
      `You won't receive any messages from ${contactName} anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => {
          try {
            await api.blockUser(token, contactId);
            setInfoModal(false);
            navigation.goBack();
          } catch (err) { Alert.alert('Error', err.message); }
        }},
      ]
    );
  };

  const handleReport = () => {
    Alert.alert(
      '⚠️ Report user?',
      `Report ${contactName} for inappropriate behavior?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: async () => {
          try {
            await api.reportUser(token, contactId);
            setInfoModal(false);
            Alert.alert('✅ Reported', 'Thanks for letting us know. We\'ll review this.');
          } catch (err) { Alert.alert('Error', err.message); }
        }},
      ]
    );
  };

  const handleDeleteChat = () => {
    Alert.alert(
      '🗑 Delete chat?',
      `This will clear all messages with ${contactName}. They\'ll reappear when someone messages again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.deleteChat(token, contactId);
            setInfoModal(false);
            navigation.goBack();
          } catch (err) { Alert.alert('Error', err.message); }
        }},
      ]
    );
  };

  const handleChangeBg = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled) {
      setChatBg(result.assets[0].uri);
      setInfoModal(false);
    }
  };

  // ── Group invite ───────────────────────────────────────────────────
  const handleGroupInviteRespond = async (inviteId, action, groupName, groupId, groupImage) => {
    setRespondingId(inviteId);
    try {
      await api.respondToGroupInvite(token, inviteId, action);
      await fetchMessages();
      if (action === 'accept') {
        Alert.alert('🎉 Joined!', `You're now in ${groupName}!`, [
          { text: 'Open group', onPress: () => navigation.navigate('GroupChat', {
            groupId, groupName, groupImage: groupImage || '',
            ownerId: null, token, displayName, profileImage: profileImage || '',
          })},
          { text: 'Later', style: 'cancel' },
        ]);
      }
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setRespondingId(null); }
  };

  const formatTime = (t) => {
    if (!t) return '';
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const formatDuration = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const tags     = vibeTags ? vibeTags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const initials = contactName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // ── Render message ─────────────────────────────────────────────────
  const renderMessage = (msg, i) => {
    const showTime = i === 0 ||
      new Date(msg.sent_at) - new Date(messages[i - 1]?.sent_at) > 5 * 60 * 1000;

    // Group invite
    if (msg.msg_type === 'group_invite' && msg.group_invite) {
      const inv       = msg.group_invite;
      const isPending = inv.status === 'pending';
      const accepted  = inv.status === 'accepted';
      const isDeleted = inv.status === 'deleted' || inv.group_id === null;
      const gi        = (inv.group_name || 'GR').slice(0, 2).toUpperCase();
      const isLoad    = respondingId === inv.invite_id;
      return (
        <View key={msg.id}>
          {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
          <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
            {!msg.is_me && (
              <View style={styles.msgAvatar}>
                {profileImage ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} /> : <Text style={styles.msgAvatarText}>{initials.slice(0,1)}</Text>}
              </View>
            )}
            <View style={styles.inviteCard}>
              <View style={styles.inviteTop}>
                <View style={styles.inviteAvatar}>
                  {inv.group_image ? <Image source={{ uri: inv.group_image }} style={styles.inviteAvatarImg} resizeMode="cover" /> : <Text style={styles.inviteAvatarText}>{gi}</Text>}
                </View>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteTitle}>{msg.is_me ? 'You invited them to' : "You're invited to"}</Text>
                  <Text style={styles.inviteGroupName} numberOfLines={1}>{inv.group_name}</Text>
                </View>
              </View>
              {isDeleted ? (
                <View style={styles.inviteStatusRow}><Text style={styles.inviteStatusText}>🗑 This group no longer exists</Text></View>
              ) : msg.is_me ? (
                <View style={styles.inviteStatusRow}><Text style={styles.inviteStatusText}>{accepted ? '✓ They joined!' : inv.status === 'declined' ? '✕ Declined' : '📨 Pending'}</Text></View>
              ) : isPending ? (
                <View style={styles.inviteBtnRow}>
                  <TouchableOpacity style={[styles.joinBtn, isLoad && { opacity:0.6 }]} onPress={() => handleGroupInviteRespond(inv.invite_id,'accept',inv.group_name,inv.group_id,inv.group_image)} disabled={isLoad} activeOpacity={0.85}>
                    {isLoad ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.joinBtnText}>✓  Join</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.declineBtn, isLoad && { opacity:0.6 }]} onPress={() => handleGroupInviteRespond(inv.invite_id,'decline',inv.group_name,inv.group_id,inv.group_image)} disabled={isLoad} activeOpacity={0.85}>
                    <Text style={styles.declineBtnText}>✕  Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inviteStatusRow}><Text style={[styles.inviteStatusText, accepted && { color:'#22C55E' }]}>{accepted ? '✓ Joined!' : '✕ Declined'}</Text></View>
              )}
            </View>
          </View>
        </View>
      );
    }

    // Image message
    if (msg.msg_type === 'image') {
      return (
        <View key={msg.id}>
          {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
          <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
            {!msg.is_me && (
              <View style={styles.msgAvatar}>
                {profileImage ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} /> : <Text style={styles.msgAvatarText}>{initials.slice(0,1)}</Text>}
              </View>
            )}
            <View style={[styles.imgBubble, msg.is_me && styles.imgBubbleMe]}>
              <Image source={{ uri: msg.text }} style={styles.msgImage} resizeMode="cover" />
              <Text style={styles.imgTime}>{formatTime(msg.sent_at)}</Text>
            </View>
          </View>
        </View>
      );
    }

    // GIF message
    if (msg.msg_type === 'gif') {
      return (
        <View key={msg.id}>
          {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
          <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
            {!msg.is_me && (
              <View style={styles.msgAvatar}>
                {profileImage ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} /> : <Text style={styles.msgAvatarText}>{initials.slice(0,1)}</Text>}
              </View>
            )}
            <View style={styles.gifBubble}>
              <Image source={{ uri: msg.text }} style={styles.msgGif} resizeMode="cover" />
              <View style={styles.gifBadge}><Text style={styles.gifBadgeText}>GIF</Text></View>
            </View>
          </View>
        </View>
      );
    }

    // Voice message
    if (msg.msg_type === 'voice') {
      const isPlaying = playingId === msg.id;
      return (
        <View key={msg.id}>
          {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
          <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
            {!msg.is_me && (
              <View style={styles.msgAvatar}>
                {profileImage ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} /> : <Text style={styles.msgAvatarText}>{initials.slice(0,1)}</Text>}
              </View>
            )}
            <TouchableOpacity
              style={[styles.voiceBubble, msg.is_me ? styles.voiceBubbleMe : styles.voiceBubbleThem]}
              onPress={() => playVoice(msg)} activeOpacity={0.8}
            >
              <Text style={[styles.voiceIcon, msg.is_me && { color:'#fff' }]}>{isPlaying ? '⏸' : '▶'}</Text>
              <View style={styles.voiceWave}>
                {[...Array(18)].map((_,i) => (
                  <View key={i} style={[styles.voiceBar, msg.is_me && styles.voiceBarMe, { height: 6 + Math.abs(Math.sin(i*0.8))*14 }]} />
                ))}
              </View>
              <Text style={[styles.voiceDuration, msg.is_me && { color:'rgba(255,255,255,0.7)' }]}>
                {formatDuration(msg.duration || 0)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Normal text
    return (
      <View key={msg.id}>
        {showTime && <Text style={styles.timeStamp}>{formatTime(msg.sent_at)}</Text>}
        <View style={[styles.msgRow, msg.is_me && styles.msgRowMe]}>
          {!msg.is_me && (
            <View style={styles.msgAvatar}>
              {profileImage ? <Image source={{ uri: profileImage }} style={styles.msgAvatarImg} /> : <Text style={styles.msgAvatarText}>{initials.slice(0,1)}</Text>}
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
      {/* Chat background */}
      {chatBg && <Image source={{ uri: chatBg }} style={styles.chatBgImage} resizeMode="cover" />}

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => setInfoModal(true)} activeOpacity={0.8}>
          <View style={styles.headerAvatar}>
            {profileImage
              ? <Image source={{ uri: profileImage }} style={styles.headerAvatarImg} />
              : <Text style={styles.headerAvatarText}>{initials}</Text>
            }
          </View>
          <View>
            <Text style={styles.headerName}>{displayContactName}</Text>
            {nickname ? <Text style={styles.headerSub}>{contactName} · {vibeCode}</Text> : <Text style={styles.headerSub}>{vibeCode}</Text>}
          </View>
        </TouchableOpacity>
        {/* ℹ️ button */}
        <TouchableOpacity style={styles.infoBtn} onPress={() => setInfoModal(true)} activeOpacity={0.8}>
          <Text style={styles.infoBtnText}>ⓘ</Text>
        </TouchableOpacity>
      </Animated.View>

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
            {messages.length === 0 && (
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatAvatar}>
                  {profileImage
                    ? <Image source={{ uri: profileImage }} style={styles.emptyChatAvatarImg} />
                    : <Text style={styles.emptyChatAvatarText}>{initials}</Text>
                  }
                </View>
                <Text style={styles.emptyChatName}>{displayContactName}</Text>
                {bio ? <Text style={styles.emptyChatBio}>{bio}</Text> : null}
                <Text style={styles.emptyChatHint}>Say hi! 👋</Text>
              </View>
            )}
            {messages.map((msg, i) => renderMessage(msg, i))}
          </ScrollView>
        )}

        {/* ── Input bar ── */}
        {isRecording ? (
          <View style={styles.recordingBar}>
            <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecBtn}>
              <Text style={styles.cancelRecText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recDot} />
              <Text style={styles.recTime}>{formatDuration(recordingTime)}</Text>
              <Text style={styles.recLabel}>Recording...</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.sendRecBtn}>
              <Text style={styles.sendRecText}>↑</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputBar}>
            {/* Attachment buttons */}
            <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage} activeOpacity={0.8}>
              <Text style={styles.attachBtnText}>🖼</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={openGifModal} activeOpacity={0.8}>
              <Text style={styles.attachBtnText}>GIF</Text>
            </TouchableOpacity>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder={`Message ${displayContactName.split(' ')[0]}...`}
                placeholderTextColor="rgba(107,107,138,0.5)"
                value={inputText}
                onChangeText={setInputText}
                multiline maxLength={500}
                autoCorrect={false}
                blurOnSubmit={false}
              />
            </View>

            {inputText.trim() ? (
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={sendMessage} activeOpacity={0.85} disabled={sending}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>↑</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.micBtn} onPressIn={startRecording} activeOpacity={0.8}>
                <Text style={styles.micBtnText}>🎤</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ══ INFO / DETAILS MODAL ══ */}
      <Modal visible={infoModal} transparent animationType="slide" onRequestClose={() => setInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoSheet}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Profile section */}
              <View style={styles.infoProfileSection}>
                <View style={styles.infoAvatar}>
                  {profileImage
                    ? <Image source={{ uri: profileImage }} style={styles.infoAvatarImg} />
                    : <Text style={styles.infoAvatarText}>{initials}</Text>
                  }
                </View>
                <Text style={styles.infoName}>{displayContactName}</Text>
                {nickname ? <Text style={styles.infoRealName}>{contactName}</Text> : null}
                <Text style={styles.infoCode}>{vibeCode}</Text>
                {bio ? <Text style={styles.infoBio}>{bio}</Text> : null}
              </View>

              <View style={styles.infoDivider} />
              <Text style={styles.infoSectionLabel}>CHAT OPTIONS</Text>

              {/* Nickname */}
              <TouchableOpacity style={styles.infoRow} onPress={() => { setNicknameInput(nickname); setInfoModal(false); setNicknameModal(true); }} activeOpacity={0.75}>
                <View style={styles.infoRowIcon}><Text style={{ fontSize:20 }}>✏️</Text></View>
                <View style={{ flex:1 }}>
                  <Text style={styles.infoRowTitle}>Nickname</Text>
                  <Text style={styles.infoRowSub}>{nickname || 'Set a nickname only you can see'}</Text>
                </View>
                <Text style={styles.infoRowArrow}>›</Text>
              </TouchableOpacity>

              {/* Change background */}
              <TouchableOpacity style={styles.infoRow} onPress={() => { setInfoModal(false); handleChangeBg(); }} activeOpacity={0.75}>
                <View style={styles.infoRowIcon}><Text style={{ fontSize:20 }}>🖼</Text></View>
                <View style={{ flex:1 }}>
                  <Text style={styles.infoRowTitle}>Chat Background</Text>
                  <Text style={styles.infoRowSub}>{chatBg ? 'Custom background set' : 'Choose from your gallery'}</Text>
                </View>
                <Text style={styles.infoRowArrow}>›</Text>
              </TouchableOpacity>

              {chatBg && (
                <TouchableOpacity style={styles.infoRow} onPress={() => { setChatBg(null); setInfoModal(false); }} activeOpacity={0.75}>
                  <View style={styles.infoRowIcon}><Text style={{ fontSize:20 }}>🔄</Text></View>
                  <View style={{ flex:1 }}>
                    <Text style={styles.infoRowTitle}>Remove Background</Text>
                    <Text style={styles.infoRowSub}>Go back to default</Text>
                  </View>
                </TouchableOpacity>
              )}

              <View style={styles.infoDivider} />
              <Text style={styles.infoSectionLabel}>ACTIONS</Text>

              {/* Block */}
              <TouchableOpacity style={styles.infoRow} onPress={() => { setInfoModal(false); handleBlock(); }} activeOpacity={0.75}>
                <View style={styles.infoRowIcon}><Text style={{ fontSize:20 }}>🚫</Text></View>
                <View style={{ flex:1 }}>
                  <Text style={[styles.infoRowTitle, { color:'#EF4444' }]}>Block</Text>
                  <Text style={styles.infoRowSub}>Stop receiving messages from them</Text>
                </View>
                <Text style={styles.infoRowArrow}>›</Text>
              </TouchableOpacity>

              {/* Report */}
              <TouchableOpacity style={styles.infoRow} onPress={() => { setInfoModal(false); handleReport(); }} activeOpacity={0.75}>
                <View style={styles.infoRowIcon}><Text style={{ fontSize:20 }}>⚠️</Text></View>
                <View style={{ flex:1 }}>
                  <Text style={[styles.infoRowTitle, { color:'#F97316' }]}>Report</Text>
                  <Text style={styles.infoRowSub}>Report inappropriate behavior</Text>
                </View>
                <Text style={styles.infoRowArrow}>›</Text>
              </TouchableOpacity>

              {/* Delete chat */}
              <TouchableOpacity style={styles.infoRow} onPress={() => { setInfoModal(false); handleDeleteChat(); }} activeOpacity={0.75}>
                <View style={styles.infoRowIcon}><Text style={{ fontSize:20 }}>🗑</Text></View>
                <View style={{ flex:1 }}>
                  <Text style={[styles.infoRowTitle, { color:'#EF4444' }]}>Delete Chat</Text>
                  <Text style={styles.infoRowSub}>Clear messages (friend stays)</Text>
                </View>
                <Text style={styles.infoRowArrow}>›</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setInfoModal(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ NICKNAME MODAL ══ */}
      <Modal visible={nicknameModal} transparent animationType="slide" onRequestClose={() => setNicknameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.smallSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.sheetTitle}>Set Nickname</Text>
            <Text style={styles.sheetSub}>Only you will see this name</Text>
            <TextInput
              style={styles.nicknameInput}
              placeholder={contactName}
              placeholderTextColor="rgba(107,107,138,0.4)"
              value={nicknameInput}
              onChangeText={setNicknameInput}
              autoCapitalize="words"
              autoFocus
              maxLength={30}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveNickname} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>Save nickname ✦</Text>
            </TouchableOpacity>
            {nickname ? (
              <TouchableOpacity style={styles.clearNicknameBtn} onPress={() => { setNicknameInput(''); setNickname(''); setNicknameModal(false); try { api.setNickname(token, contactId, ''); } catch {} }} activeOpacity={0.75}>
                <Text style={styles.clearNicknameBtnText}>Remove nickname</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setNicknameModal(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ GIF PICKER MODAL ══ */}
      <Modal visible={gifModal} transparent animationType="slide" onRequestClose={() => setGifModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.gifSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.sheetTitle}>Send a GIF</Text>
            <View style={styles.gifSearchBar}>
              <Text style={{ fontSize:14, marginRight:6 }}>🔍</Text>
              <TextInput
                style={styles.gifSearchInput}
                placeholder="Search GIFs..."
                placeholderTextColor="rgba(107,107,138,0.5)"
                value={gifSearch}
                onChangeText={t => { setGifSearch(t); searchGifs(t); }}
                autoCorrect={false}
              />
            </View>
            {gifLoading ? (
              <ActivityIndicator size="large" color="#7B5EA7" style={{ marginTop:20 }} />
            ) : (
              <FlatList
                data={gifs}
                numColumns={2}
                keyExtractor={item => item.id}
                style={{ marginTop:8 }}
                contentContainerStyle={{ gap:6, paddingHorizontal:4 }}
                columnWrapperStyle={{ gap:6 }}
                renderItem={({ item }) => {
                  const preview = item.media_formats?.tinygif?.url || item.media_formats?.gif?.url;
                  return (
                    <TouchableOpacity onPress={() => sendGif(item)} activeOpacity={0.8} style={styles.gifThumb}>
                      {preview ? <Image source={{ uri: preview }} style={styles.gifThumbImg} resizeMode="cover" /> : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setGifModal(false)}>
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
  chatBgImage: { position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0.18, zIndex:0 },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(107,107,138,0.08)', backgroundColor:'rgba(250,250,248,0.95)', gap:10, zIndex:1 },
  backBtn: { padding:4 },
  backText: { fontSize:22, color:'#1A1A2E' },
  headerCenter: { flex:1, flexDirection:'row', alignItems:'center', gap:10 },
  headerAvatar: { width:40, height:40, borderRadius:20, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  headerAvatarImg: { width:40, height:40, borderRadius:20 },
  headerAvatarText: { color:'#fff', fontSize:14, fontWeight:'600' },
  headerName: { fontSize:16, color:'#1A1A2E', fontWeight:'600' },
  headerSub: { fontSize:11, color:'#B39DDB', letterSpacing:0.5 },
  infoBtn: { width:36, height:36, borderRadius:18, backgroundColor:'#F0EFF8', alignItems:'center', justifyContent:'center' },
  infoBtnText: { fontSize:20, color:'#7B5EA7' },

  loadingWrap: { flex:1, alignItems:'center', justifyContent:'center' },
  messageList: { flex:1, zIndex:1 },
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

  // Image bubble
  imgBubble: { borderRadius:16, overflow:'hidden', borderWidth:1.5, borderColor:'rgba(107,107,138,0.1)' },
  imgBubbleMe: { borderColor:'rgba(26,26,46,0.2)' },
  msgImage: { width:200, height:200 },
  imgTime: { position:'absolute', bottom:6, right:8, fontSize:10, color:'rgba(255,255,255,0.9)', fontWeight:'600' },

  // GIF bubble
  gifBubble: { borderRadius:16, overflow:'hidden', position:'relative' },
  msgGif: { width:200, height:160 },
  gifBadge: { position:'absolute', top:6, left:6, backgroundColor:'rgba(0,0,0,0.55)', borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  gifBadgeText: { color:'#fff', fontSize:10, fontWeight:'700', letterSpacing:1 },

  // Voice bubble
  voiceBubble: { flexDirection:'row', alignItems:'center', borderRadius:24, paddingHorizontal:14, paddingVertical:10, gap:8, maxWidth:'72%' },
  voiceBubbleMe: { backgroundColor:'#1A1A2E' },
  voiceBubbleThem: { backgroundColor:'#F0EFF8' },
  voiceIcon: { fontSize:18, color:'#1A1A2E' },
  voiceWave: { flexDirection:'row', alignItems:'center', gap:2, flex:1 },
  voiceBar: { width:3, borderRadius:2, backgroundColor:'rgba(123,94,167,0.5)' },
  voiceBarMe: { backgroundColor:'rgba(255,255,255,0.5)' },
  voiceDuration: { fontSize:12, color:'#6B6B8A', minWidth:32 },

  // Input bar
  inputBar: { flexDirection:'row', alignItems:'flex-end', paddingHorizontal:10, paddingVertical:10, borderTopWidth:1, borderTopColor:'rgba(107,107,138,0.08)', gap:6, backgroundColor:'rgba(250,250,248,0.97)', zIndex:1 },
  attachBtn: { width:36, height:36, borderRadius:18, backgroundColor:'#F0EFF8', alignItems:'center', justifyContent:'center' },
  attachBtnText: { fontSize:13, color:'#7B5EA7', fontWeight:'700' },
  inputWrap: { flex:1, backgroundColor:'#F0EFF8', borderRadius:22, paddingHorizontal:14, paddingVertical:10, minHeight:44, justifyContent:'center' },
  input: { fontSize:15, color:'#1A1A2E', maxHeight:100, padding:0 },
  sendBtn: { width:44, height:44, borderRadius:22, backgroundColor:'#1A1A2E', alignItems:'center', justifyContent:'center', shadowColor:'#1A1A2E', shadowOffset:{width:0,height:3}, shadowOpacity:0.2, shadowRadius:6, elevation:3 },
  sendBtnDisabled: { backgroundColor:'rgba(107,107,138,0.2)', shadowOpacity:0, elevation:0 },
  sendBtnText: { color:'#fff', fontSize:20, fontWeight:'700', lineHeight:24 },
  micBtn: { width:44, height:44, borderRadius:22, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center' },
  micBtnText: { fontSize:20 },

  // Recording bar
  recordingBar: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, borderTopWidth:1, borderTopColor:'rgba(107,107,138,0.08)', backgroundColor:'rgba(250,250,248,0.97)', gap:12 },
  cancelRecBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(239,68,68,0.1)', alignItems:'center', justifyContent:'center' },
  cancelRecText: { fontSize:16, color:'#EF4444', fontWeight:'700' },
  recordingIndicator: { flex:1, flexDirection:'row', alignItems:'center', gap:8 },
  recDot: { width:10, height:10, borderRadius:5, backgroundColor:'#EF4444' },
  recTime: { fontSize:16, color:'#1A1A2E', fontWeight:'600' },
  recLabel: { fontSize:13, color:'#6B6B8A', fontStyle:'italic' },
  sendRecBtn: { width:44, height:44, borderRadius:22, backgroundColor:'#1A1A2E', alignItems:'center', justifyContent:'center' },
  sendRecText: { color:'#fff', fontSize:20, fontWeight:'700', lineHeight:24 },

  // Invite card
  inviteCard: { width:240, backgroundColor:'#fff', borderRadius:16, borderWidth:1.5, borderColor:'rgba(123,94,167,0.2)', overflow:'hidden', shadowColor:'#7B5EA7', shadowOpacity:0.08, shadowRadius:8, elevation:2 },
  inviteTop: { flexDirection:'row', alignItems:'center', padding:12, gap:10 },
  inviteAvatar: { width:44, height:44, borderRadius:12, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 },
  inviteAvatarImg: { width:44, height:44 },
  inviteAvatarText: { color:'#fff', fontSize:16, fontWeight:'700' },
  inviteInfo: { flex:1 },
  inviteTitle: { fontSize:11, color:'#6B6B8A', marginBottom:2 },
  inviteGroupName: { fontSize:15, color:'#1A1A2E', fontWeight:'600' },
  inviteBtnRow: { flexDirection:'row', borderTopWidth:1, borderTopColor:'rgba(107,107,138,0.1)', height:42 },
  joinBtn: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#22C55E' },
  joinBtnText: { color:'#fff', fontSize:14, fontWeight:'700' },
  declineBtn: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#EF4444', borderLeftWidth:1, borderLeftColor:'rgba(255,255,255,0.15)' },
  declineBtnText: { color:'#fff', fontSize:14, fontWeight:'700' },
  inviteStatusRow: { borderTopWidth:1, borderTopColor:'rgba(107,107,138,0.1)', paddingVertical:9, alignItems:'center', backgroundColor:'rgba(107,107,138,0.03)' },
  inviteStatusText: { fontSize:12, color:'#6B6B8A', fontStyle:'italic' },

  // Modals
  modalOverlay: { flex:1, backgroundColor:'rgba(26,26,46,0.5)', justifyContent:'flex-end' },
  infoSheet: { backgroundColor:'#FAFAF8', borderTopLeftRadius:32, borderTopRightRadius:32, padding:24, paddingBottom:48, maxHeight:'90%' },
  smallSheet: { backgroundColor:'#FAFAF8', borderTopLeftRadius:32, borderTopRightRadius:32, padding:28, paddingBottom:48 },
  gifSheet: { backgroundColor:'#FAFAF8', borderTopLeftRadius:32, borderTopRightRadius:32, padding:20, paddingBottom:36, maxHeight:'85%' },
  modalHandle: { width:40, height:4, borderRadius:2, backgroundColor:'rgba(107,107,138,0.2)', alignSelf:'center', marginBottom:20 },
  sheetTitle: { fontStyle:'italic', fontSize:22, color:'#1A1A2E', fontWeight:'300', textAlign:'center', marginBottom:4 },
  sheetSub: { fontSize:13, color:'#6B6B8A', textAlign:'center', marginBottom:16, fontStyle:'italic' },

  // Info sheet
  infoProfileSection: { alignItems:'center', marginBottom:16 },
  infoAvatar: { width:72, height:72, borderRadius:36, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden', marginBottom:10 },
  infoAvatarImg: { width:72, height:72, borderRadius:36 },
  infoAvatarText: { color:'#fff', fontSize:24, fontWeight:'600' },
  infoName: { fontSize:22, color:'#1A1A2E', fontStyle:'italic', fontWeight:'300', marginBottom:2 },
  infoRealName: { fontSize:13, color:'#B39DDB', marginBottom:2 },
  infoCode: { fontSize:12, color:'#B39DDB', letterSpacing:1.5, marginBottom:8 },
  infoBio: { fontSize:13, color:'#6B6B8A', textAlign:'center', maxWidth:260, fontStyle:'italic' },
  infoDivider: { height:1, backgroundColor:'rgba(107,107,138,0.1)', marginVertical:14 },
  infoSectionLabel: { fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#6B6B8A', fontWeight:'600', marginBottom:10 },
  infoRow: { flexDirection:'row', alignItems:'center', paddingVertical:14, gap:12, borderBottomWidth:1, borderBottomColor:'rgba(107,107,138,0.06)' },
  infoRowIcon: { width:40, height:40, borderRadius:12, backgroundColor:'#F0EFF8', alignItems:'center', justifyContent:'center' },
  infoRowTitle: { fontSize:15, color:'#1A1A2E', fontWeight:'500' },
  infoRowSub: { fontSize:12, color:'#6B6B8A', marginTop:1 },
  infoRowArrow: { fontSize:20, color:'#B39DDB' },

  // Nickname
  nicknameInput: { backgroundColor:'#F0EFF8', borderRadius:14, padding:14, fontSize:17, color:'#1A1A2E', fontStyle:'italic', marginBottom:16 },
  clearNicknameBtn: { alignItems:'center', paddingVertical:10 },
  clearNicknameBtnText: { fontSize:14, color:'#EF4444' },

  // GIF picker
  gifSearchBar: { flexDirection:'row', alignItems:'center', backgroundColor:'#F0EFF8', borderRadius:14, paddingHorizontal:14, paddingVertical:10, marginBottom:4 },
  gifSearchInput: { flex:1, fontSize:15, color:'#1A1A2E', padding:0 },
  gifThumb: { flex:1, height:110, borderRadius:12, overflow:'hidden', backgroundColor:'#F0EFF8' },
  gifThumbImg: { width:'100%', height:'100%' },

  btnPrimary: { backgroundColor:'#1A1A2E', borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:8 },
  btnPrimaryText: { color:'#fff', fontSize:16, fontWeight:'500' },
  closeBtn: { alignItems:'center', paddingVertical:12 },
  closeBtnText: { fontSize:15, color:'#6B6B8A', fontStyle:'italic' },
});