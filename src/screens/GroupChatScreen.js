import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const VIBE_GOAL = 20; // messages needed to unlock challenge (lower for demo)

const MOCK_MESSAGES = [
  { id: 1, senderId: 1, senderName: 'Marco V.',  senderEmoji: '🧑‍🎤', text: 'yooo the crew is back 🔥',       time: '22:30', isMe: false },
  { id: 2, senderId: 2, senderName: 'Sarah K.',  senderEmoji: '👩‍💻', text: 'finally!! i missed this group lol', time: '22:31', isMe: false },
  { id: 3, senderId: 0, senderName: 'You',        senderEmoji: '🧑‍🎤', text: 'let\'s gooo 🎉',                  time: '22:31', isMe: true  },
  { id: 4, senderId: 1, senderName: 'Marco V.',  senderEmoji: '🧑‍🎤', text: 'who\'s ready for the wheel 😈',   time: '22:32', isMe: false },
  { id: 5, senderId: 3, senderName: 'Jordan T.', senderEmoji: '🧙',  text: 'omg not the wheel again 💀',       time: '22:33', isMe: false },
];

const CHALLENGE_DARES = [
  '📸 Everyone send their most recent photo in their camera roll',
  '🎤 Voice note only for the next 5 messages',
  '💬 Describe your week using only emojis',
  '🔮 Everyone share their most embarrassing recent memory',
  '🎭 Everyone text in a different accent for 10 minutes',
  '📞 Someone has to call another member right now',
  '🖼️ Share the last meme you sent someone',
  '🤫 Reveal something nobody in this group knows about you',
];

export default function GroupChatScreen({ navigation, route }) {
  const groupName   = route?.params?.groupName   || 'College Crew 🎓';
  const groupEmoji  = route?.params?.groupEmoji  || '🎓';
  const members     = route?.params?.members     || [];
  const profileImage = route?.params?.profileImage || null;

  const [messages,        setMessages]        = useState(MOCK_MESSAGES);
  const [inputText,       setInputText]       = useState('');
  const [vibeCount,       setVibeCount]       = useState(MOCK_MESSAGES.length);
  const [challengeReady,  setChallengeReady]  = useState(false);
  const [challengeModal,  setChallengeModal]  = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState('');
  const [spinning,        setSpinning]        = useState(false);
  const [showChallenge,   setShowChallenge]   = useState(false);
  const [infoModal,       setInfoModal]       = useState(false);

  // Animations
  const scrollRef      = useRef(null);
  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const vibeMeterAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const spinAnim       = useRef(new Animated.Value(0)).current;
  const challengeFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Update vibe meter when messages change
  useEffect(() => {
    const progress = Math.min(vibeCount / VIBE_GOAL, 1);
    Animated.timing(vibeMeterAnim, { toValue: progress, duration: 600, useNativeDriver: false }).start();
    if (vibeCount >= VIBE_GOAL && !challengeReady) {
      setChallengeReady(true);
      startPulse();
    }
  }, [vibeCount]);

  // Pulse animation for challenge button
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg = {
      id: Date.now(),
      senderId: 0,
      senderName: 'You',
      senderEmoji: '🧑‍🎤',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };
    setMessages(prev => [...prev, newMsg]);
    setVibeCount(prev => prev + 1);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const spinWheel = () => {
    setSpinning(true);
    setShowChallenge(false);
    challengeFade.setValue(0);

    Animated.timing(spinAnim, { toValue: 1, duration: 1800, useNativeDriver: true }).start(() => {
      const dare = CHALLENGE_DARES[Math.floor(Math.random() * CHALLENGE_DARES.length)];
      setCurrentChallenge(dare);
      setSpinning(false);
      setShowChallenge(true);
      spinAnim.setValue(0);
      Animated.timing(challengeFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    });
  };

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1440deg'],
  });

  const vibeWidth = vibeMeterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const vibeColor = vibeMeterAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#B39DDB', '#7B5EA7', '#FF6B35'],
  });

  const progress = Math.min(Math.round((vibeCount / VIBE_GOAL) * 100), 100);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} onPress={() => setInfoModal(true)} activeOpacity={0.8}>
          <View style={styles.groupAvatarSmall}>
            <Text style={styles.groupAvatarEmoji}>{groupEmoji}</Text>
          </View>
          <View>
            <Text style={styles.headerGroupName}>{groupName}</Text>
            <Text style={styles.headerMemberCount}>{members.length > 0 ? members.length : 6} members · tap for info</Text>
          </View>
        </TouchableOpacity>

        {/* Challenge button — pulses when ready */}
        <Animated.View style={{ transform: [{ scale: challengeReady ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            style={[styles.challengeBtn, challengeReady && styles.challengeBtnReady]}
            onPress={() => challengeReady && setChallengeModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.challengeBtnText}>{challengeReady ? '🎰' : '🎯'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── Vibe Meter ── */}
      <Animated.View style={[styles.vibeMeterWrap, { opacity: fadeAnim }]}>
        <View style={styles.vibeMeterRow}>
          <Text style={styles.vibeMeterLabel}>
            {challengeReady ? '🔥 Challenge ready!' : `⚡ Vibe meter — ${progress}%`}
          </Text>
          <Text style={styles.vibeMeterCount}>{vibeCount} msgs</Text>
        </View>
        <View style={styles.vibeMeterBar}>
          <Animated.View style={[styles.vibeMeterFill, { width: vibeWidth, backgroundColor: vibeColor }]} />
        </View>
      </Animated.View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* System message */}
          <View style={styles.systemMsg}>
            <Text style={styles.systemMsgText}>✦ Fun-Star created — let's get the vibe going!</Text>
          </View>

          {messages.map((msg, i) => {
            const showName = !msg.isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);
            return (
              <View key={msg.id} style={[styles.msgRow, msg.isMe && styles.msgRowMe]}>
                {/* Avatar for others */}
                {!msg.isMe && (
                  <View style={[styles.msgAvatar, { opacity: showName ? 1 : 0 }]}>
                    <Text style={styles.msgAvatarEmoji}>{msg.senderEmoji}</Text>
                  </View>
                )}

                <View style={[styles.msgBubbleWrap, msg.isMe && styles.msgBubbleWrapMe]}>
                  {showName && !msg.isMe && (
                    <Text style={styles.msgSenderName}>{msg.senderName}</Text>
                  )}
                  <View style={[styles.msgBubble, msg.isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                    <Text style={[styles.msgText, msg.isMe && styles.msgTextMe]}>{msg.text}</Text>
                  </View>
                  <Text style={[styles.msgTime, msg.isMe && styles.msgTimeMe]}>{msg.time}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Send a vibe..."
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── CHALLENGE MODAL ── */}
      <Modal visible={challengeModal} transparent animationType="slide" onRequestClose={() => setChallengeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.challengeSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.challengeSheetTitle}>🎰 Challenge Wheel</Text>
            <Text style={styles.challengeSheetSub}>Your crew earned this — spin to reveal the dare!</Text>

            {/* Wheel */}
            <View style={styles.wheelSection}>
              <Animated.Text style={[styles.wheelEmoji, spinning && { transform: [{ rotate: spinRotate }] }]}>
                🎡
              </Animated.Text>
            </View>

            {/* Challenge result */}
            {showChallenge && (
              <Animated.View style={[styles.challengeResult, { opacity: challengeFade }]}>
                <Text style={styles.challengeResultLabel}>YOUR DARE</Text>
                <Text style={styles.challengeResultText}>{currentChallenge}</Text>
              </Animated.View>
            )}

            <TouchableOpacity
              style={[styles.spinBtn, spinning && styles.spinBtnDisabled]}
              onPress={spinWheel}
              activeOpacity={0.85}
            >
              <Text style={styles.spinBtnText}>{spinning ? 'Spinning...' : showChallenge ? '🔄 Spin again' : '🎰 Spin the wheel!'}</Text>
            </TouchableOpacity>

            {showChallenge && (
              <TouchableOpacity
                style={styles.acceptBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setChallengeModal(false);
                  setShowChallenge(false);
                  setVibeCount(0);
                  setChallengeReady(false);
                  pulseAnim.setValue(1);
                  vibeMeterAnim.setValue(0);
                  setMessages(prev => [...prev, {
                    id: Date.now(),
                    senderId: -1,
                    senderName: 'System',
                    senderEmoji: '🎰',
                    text: `🎰 Challenge accepted: "${currentChallenge}"`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isMe: false,
                    isSystem: true,
                  }]);
                }}
              >
                <Text style={styles.acceptBtnText}>✦ Accept this dare!</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalCancel} onPress={() => setChallengeModal(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── GROUP INFO MODAL ── */}
      <Modal visible={infoModal} transparent animationType="slide" onRequestClose={() => setInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.infoGroupAvatar}>
              <Text style={styles.infoGroupAvatarEmoji}>{groupEmoji}</Text>
            </View>
            <Text style={styles.infoGroupName}>{groupName}</Text>
            <Text style={styles.infoMemberLabel}>MEMBERS</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {(members.length > 0 ? members : [
                { id: 1, name: 'Marco V.',  emoji: '🧑‍🎤', isMe: false },
                { id: 2, name: 'Sarah K.',  emoji: '👩‍💻', isMe: false },
                { id: 3, name: 'Jordan T.', emoji: '🧙',  isMe: false },
                { id: 0, name: 'You',       emoji: '🧑‍🎤', isMe: true  },
              ]).map(m => (
                <View key={m.id} style={styles.infoMemberRow}>
                  <View style={styles.infoMemberAvatar}>
                    {m.isMe && profileImage
                      ? <Image source={{ uri: profileImage }} style={styles.infoMemberAvatarImg} />
                      : <Text style={styles.infoMemberEmoji}>{m.emoji}</Text>
                    }
                  </View>
                  <Text style={styles.infoMemberName}>{m.name}</Text>
                  {m.isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setInfoModal(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(107,107,138,0.08)', gap: 10, backgroundColor: '#FAFAF8' },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: '#1A1A2E' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvatarSmall: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(123,94,167,0.12)', alignItems: 'center', justifyContent: 'center' },
  groupAvatarEmoji: { fontSize: 20 },
  headerGroupName: { fontSize: 16, color: '#1A1A2E', fontWeight: '600' },
  headerMemberCount: { fontSize: 11, color: '#6B6B8A', marginTop: 1 },
  challengeBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.15)' },
  challengeBtnReady: { backgroundColor: 'rgba(255,107,53,0.1)', borderColor: '#FF6B35', shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  challengeBtnText: { fontSize: 20 },

  // Vibe meter
  vibeMeterWrap: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FAFAF8', borderBottomWidth: 1, borderBottomColor: 'rgba(107,107,138,0.06)' },
  vibeMeterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  vibeMeterLabel: { fontSize: 11, color: '#6B6B8A', fontStyle: 'italic' },
  vibeMeterCount: { fontSize: 11, color: '#B39DDB', fontWeight: '500' },
  vibeMeterBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(107,107,138,0.1)', overflow: 'hidden' },
  vibeMeterFill: { height: '100%', borderRadius: 2 },

  // Messages
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 4 },

  systemMsg: { alignItems: 'center', marginVertical: 12 },
  systemMsgText: { fontSize: 12, color: '#B39DDB', fontStyle: 'italic', textAlign: 'center', backgroundColor: 'rgba(179,157,219,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center' },
  msgAvatarEmoji: { fontSize: 14 },
  msgBubbleWrap: { maxWidth: '75%' },
  msgBubbleWrapMe: { alignItems: 'flex-end' },
  msgSenderName: { fontSize: 11, color: '#7B5EA7', fontWeight: '500', marginBottom: 3, marginLeft: 4 },
  msgBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleMe: { backgroundColor: '#1A1A2E', borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: '#F0EFF8', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: '#1A1A2E', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: 'rgba(107,107,138,0.5)', marginTop: 3, marginLeft: 4 },
  msgTimeMe: { marginLeft: 0, marginRight: 4 },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(107,107,138,0.08)', gap: 8, backgroundColor: '#FAFAF8' },
  inputWrap: { flex: 1, backgroundColor: '#F0EFF8', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  input: { fontSize: 15, color: '#1A1A2E', maxHeight: 100, padding: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  sendBtnDisabled: { backgroundColor: 'rgba(107,107,138,0.2)', shadowOpacity: 0, elevation: 0 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,46,0.45)', justifyContent: 'flex-end' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(107,107,138,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalCancel: { alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { fontSize: 15, color: '#6B6B8A', fontStyle: 'italic' },

  // Challenge modal
  challengeSheet: { backgroundColor: '#FAFAF8', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 44 },
  challengeSheetTitle: { fontStyle: 'italic', fontSize: 28, color: '#1A1A2E', fontWeight: '300', textAlign: 'center' },
  challengeSheetSub: { fontSize: 13, color: '#6B6B8A', textAlign: 'center', marginTop: 6, marginBottom: 24, fontStyle: 'italic' },
  wheelSection: { alignItems: 'center', marginBottom: 24 },
  wheelEmoji: { fontSize: 90 },
  challengeResult: { backgroundColor: 'rgba(123,94,167,0.07)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(123,94,167,0.2)' },
  challengeResultLabel: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#B39DDB', marginBottom: 8, textAlign: 'center' },
  challengeResultText: { fontSize: 17, color: '#1A1A2E', textAlign: 'center', lineHeight: 24, fontWeight: '500' },
  spinBtn: { backgroundColor: '#FF6B35', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  spinBtnDisabled: { backgroundColor: 'rgba(107,107,138,0.2)', shadowOpacity: 0, elevation: 0 },
  spinBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  acceptBtn: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 4, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  acceptBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // Info modal
  infoSheet: { backgroundColor: '#FAFAF8', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 44 },
  infoGroupAvatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(123,94,167,0.1)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: 'rgba(123,94,167,0.2)' },
  infoGroupAvatarEmoji: { fontSize: 36 },
  infoGroupName: { fontStyle: 'italic', fontSize: 24, color: '#1A1A2E', fontWeight: '300', textAlign: 'center', marginBottom: 20 },
  infoMemberLabel: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', fontWeight: '500', marginBottom: 12 },
  infoMemberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(107,107,138,0.07)' },
  infoMemberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  infoMemberAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  infoMemberEmoji: { fontSize: 20 },
  infoMemberName: { flex: 1, fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  youBadge: { backgroundColor: 'rgba(123,94,167,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  youBadgeText: { fontSize: 11, color: '#7B5EA7', fontWeight: '600' },
});