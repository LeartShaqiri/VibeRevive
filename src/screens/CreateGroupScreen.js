import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_CONTACTS = [
  { id: 1, name: 'Marco V.',  emoji: '🧑‍🎤', vibeCode: 'VibeK9P', online: true  },
  { id: 2, name: 'Sarah K.',  emoji: '👩‍💻', vibeCode: 'VibeR3T', online: true  },
  { id: 3, name: 'Jordan T.', emoji: '🧙',  vibeCode: 'VibeZ2W', online: false },
  { id: 4, name: 'Emma R.',   emoji: '🌟',  vibeCode: 'VibeM7X', online: false },
  { id: 5, name: 'Alex B.',   emoji: '🎮',  vibeCode: 'VibeA4X', online: false },
];

const GROUP_EMOJIS = ['🎓','💼','💪','🍜','🎮','🎵','🏖️','🔥','✨','🌙','🎉','🐾'];

export default function CreateGroupScreen({ navigation, route }) {
  const currentUser = route?.params?.displayName || 'You';
  const profileImage = route?.params?.profileImage || null;

  const [groupName,     setGroupName]     = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎉');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search,        setSearch]        = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const toggleUser = (user) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else if (selectedUsers.length < 19) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const filteredContacts = MOCK_CONTACTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const canCreate = groupName.trim().length > 0 && selectedUsers.length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    navigation.navigate('GroupChat', {
      groupName: groupName.trim(),
      groupEmoji: selectedEmoji,
      members: [{ id: 0, name: currentUser, emoji: '🧑‍🎤', isMe: true, profileImage }, ...selectedUsers],
      currentUser,
      profileImage,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.blobTop} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Fun-Star</Text>
        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={handleCreate}
          activeOpacity={0.85}
        >
          <Text style={[styles.createBtnText, !canCreate && styles.createBtnTextDisabled]}>Create</Text>
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Group icon + name */}
          <Animated.View style={[styles.groupIconSection, { opacity: fadeAnim }]}>
            <View style={styles.groupIconWrap}>
              <Text style={styles.groupIconText}>{selectedEmoji}</Text>
            </View>
            <TextInput
              style={styles.groupNameInput}
              placeholder="Group name..."
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={groupName}
              onChangeText={setGroupName}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
          </Animated.View>

          {/* Emoji picker */}
          <Animated.View style={[{ opacity: fadeAnim }, styles.section]}>
            <Text style={styles.sectionLabel}>PICK AN ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {GROUP_EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setSelectedEmoji(emoji)}
                  style={[styles.emojiOption, selectedEmoji === emoji && styles.emojiOptionActive]}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Selected members preview */}
          {selectedUsers.length > 0 && (
            <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
              <Text style={styles.sectionLabel}>MEMBERS ({selectedUsers.length + 1}/20)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {/* Always show self first */}
                <View style={styles.selectedMember}>
                  <View style={[styles.selectedMemberAvatar, { backgroundColor: '#7B5EA7' }]}>
                    {profileImage
                      ? <Image source={{ uri: profileImage }} style={styles.selectedMemberAvatarImg} />
                      : <Text style={{ fontSize: 18 }}>🧑‍🎤</Text>
                    }
                  </View>
                  <Text style={styles.selectedMemberName}>You</Text>
                </View>
                {selectedUsers.map(u => (
                  <TouchableOpacity key={u.id} style={styles.selectedMember} onPress={() => toggleUser(u)}>
                    <View style={styles.selectedMemberAvatar}>
                      <Text style={{ fontSize: 18 }}>{u.emoji}</Text>
                    </View>
                    <View style={styles.removeBadge}><Text style={styles.removeBadgeText}>✕</Text></View>
                    <Text style={styles.selectedMemberName} numberOfLines={1}>{u.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Contact search + list */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={styles.sectionLabel}>ADD MEMBERS</Text>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor="rgba(107,107,138,0.5)"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {filteredContacts.map(contact => {
              const selected = !!selectedUsers.find(u => u.id === contact.id);
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={[styles.contactRow, selected && styles.contactRowSelected]}
                  onPress={() => toggleUser(contact)}
                  activeOpacity={0.75}
                >
                  <View style={styles.contactAvatarWrap}>
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactEmoji}>{contact.emoji}</Text>
                    </View>
                    {contact.online && <View style={styles.onlineDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactCode}>{contact.vibeCode}</Text>
                  </View>
                  <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                    {selected && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Create button */}
          <Animated.View style={[{ marginTop: 8, marginBottom: 16 }, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={[styles.btnPrimary, !canCreate && styles.btnDisabled]}
              activeOpacity={0.85}
              onPress={handleCreate}
            >
              <Text style={styles.btnPrimaryText}>
                {canCreate ? `🚀 Create "${groupName}" with ${selectedUsers.length + 1} members` : 'Name your group & add members'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  blobTop: { position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(179,157,219,0.1)' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 15, color: '#6B6B8A', fontStyle: 'italic' },
  headerTitle: { fontStyle: 'italic', fontSize: 20, color: '#1A1A2E', fontWeight: '300' },
  createBtn: { backgroundColor: '#7B5EA7', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  createBtnDisabled: { backgroundColor: 'rgba(107,107,138,0.15)' },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  createBtnTextDisabled: { color: 'rgba(107,107,138,0.5)' },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  groupIconSection: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, marginTop: 8 },
  groupIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(123,94,167,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(123,94,167,0.2)' },
  groupIconText: { fontSize: 32 },
  groupNameInput: { flex: 1, fontStyle: 'italic', fontSize: 22, color: '#1A1A2E', borderBottomWidth: 1.5, borderBottomColor: 'rgba(123,94,167,0.2)', paddingBottom: 8, fontWeight: '300' },

  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', fontWeight: '500', marginBottom: 12 },

  emojiOption: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1.5, borderColor: 'transparent' },
  emojiOptionActive: { backgroundColor: 'rgba(123,94,167,0.12)', borderColor: '#7B5EA7' },
  emojiOptionText: { fontSize: 22 },

  selectedMember: { alignItems: 'center', marginRight: 12, width: 56, position: 'relative' },
  selectedMemberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(123,94,167,0.2)' },
  selectedMemberAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  selectedMemberName: { fontSize: 11, color: '#6B6B8A', marginTop: 4, textAlign: 'center' },
  removeBadge: { position: 'absolute', top: -2, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  removeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0EFF8', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8, marginBottom: 12 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E', padding: 0 },

  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 6, backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.08)', gap: 12 },
  contactRowSelected: { borderColor: 'rgba(123,94,167,0.3)', backgroundColor: 'rgba(123,94,167,0.04)' },
  contactAvatarWrap: { position: 'relative' },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center' },
  contactEmoji: { fontSize: 22 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#fff' },
  contactName: { fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  contactCode: { fontSize: 11, color: '#B39DDB', letterSpacing: 0.5, marginTop: 1 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(107,107,138,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkCircleSelected: { backgroundColor: '#7B5EA7', borderColor: '#7B5EA7' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },

  btnPrimary: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },
  btnDisabled: { backgroundColor: 'rgba(107,107,138,0.2)', shadowOpacity: 0, elevation: 0 },
});