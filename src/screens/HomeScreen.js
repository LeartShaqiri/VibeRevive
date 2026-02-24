import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, Modal, Alert, RefreshControl, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';

const AVATAR_BORDERS = [
  { id: 'none',        label: 'None',      borderColor: 'transparent', shadowColor: 'transparent' },
  { id: 'glow_blue',   label: '💙 Blue',   borderColor: '#00D4FF',     shadowColor: '#00D4FF' },
  { id: 'glow_pink',   label: '💗 Pink',   borderColor: '#FF69B4',     shadowColor: '#FF69B4' },
  { id: 'glow_purple', label: '💜 Purple', borderColor: '#7B5EA7',     shadowColor: '#7B5EA7' },
  { id: 'glow_gold',   label: '✨ Gold',   borderColor: '#FFD700',     shadowColor: '#FFD700' },
];

const DAYS_SINCE_NAME_CHANGE = 35;

export default function HomeScreen({ navigation, route }) {
  const [displayName,    setDisplayName]    = useState(route?.params?.displayName    || 'You');
  const [vibeCode,       setVibeCode]       = useState(route?.params?.vibeCode       || 'VibeXXX');
  const [profileImage,   setProfileImage]   = useState(route?.params?.profileImage   || null);
  const [selectedBorder, setSelectedBorder] = useState(route?.params?.selectedBorder || 'glow_purple');
  const [selectedTags]                      = useState(route?.params?.selectedTags   || []);
  const [selectedVibe]                      = useState(route?.params?.selectedVibe   || null);
  const [bio,            setBio]            = useState(route?.params?.bio            || '');
  const token                               = route?.params?.token || '';

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editBio,             setEditBio]             = useState(bio);
  const [editName,            setEditName]            = useState(displayName);
  const [editBorder,          setEditBorder]          = useState(selectedBorder);
  const [editImage,           setEditImage]           = useState(profileImage);
  const canEditName   = DAYS_SINCE_NAME_CHANGE >= 30;
  const daysUntilEdit = 30 - DAYS_SINCE_NAME_CHANGE;

  // Real contacts from backend
  const [contacts,        setContacts]        = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [searchText,      setSearchText]      = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [actionModal,     setActionModal]     = useState(false);
  const [codeInput,       setCodeInput]       = useState('');
  const [addingContact,   setAddingContact]   = useState(false);
  const [activeFilter,    setActiveFilter]    = useState('All');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Reload contacts every time screen comes into focus (e.g. after coming back from chat)
  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [token])
  );

  const loadContacts = async () => {
    if (!token) return;
    try {
      const data = await api.getContacts(token);
      setContacts(data.contacts || []);
    } catch (err) {
      console.log('Error loading contacts:', err.message);
    } finally {
      setLoadingContacts(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const filters = ['All', 'Unread'];
  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchText.toLowerCase());
    if (activeFilter === 'Unread') return matchSearch && c.unread > 0;
    return matchSearch;
  });

  const pickEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setEditImage(result.assets[0].uri);
  };

  const saveProfile = () => {
    setDisplayName(editName);
    setBio(editBio);
    setProfileImage(editImage);
    setSelectedBorder(editBorder);
    setProfileModalVisible(false);
  };

  const openProfileModal = () => {
    setEditBio(bio);
    setEditName(displayName);
    setEditBorder(selectedBorder);
    setEditImage(profileImage);
    setProfileModalVisible(true);
  };

  const handleAddContact = async () => {
    const trimmed = codeInput.trim();
    if (!trimmed.startsWith('Vibe') || trimmed.length < 7) {
      Alert.alert('Invalid code', 'Enter a valid VibeCode (e.g. VibeAB123)');
      return;
    }
    setAddingContact(true);
    try {
      const data = await api.addContact(token, trimmed);
      setCodeInput('');
      setAddModalVisible(false);
      Alert.alert('🎉 Added!', `${data.contact.first_name} is now in your contacts.`);
      loadContacts(); // refresh list
    } catch (err) {
      Alert.alert('Oops', err.message);
    } finally {
      setAddingContact(false);
    }
  };

  const handleContactPress = (contact) => {
    navigation.navigate('Chat', {
      contactId:   contact.id,
      contactName: contact.name,
      vibeCode:    contact.vibe_code,
      token,
      displayName,
      profileImage,
    });
  };

  // Format timestamp nicely
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const activeBorder     = AVATAR_BORDERS.find(b => b.id === selectedBorder);
  const editActiveBorder = AVATAR_BORDERS.find(b => b.id === editBorder);
  const initials         = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.blobTop} />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={openProfileModal} activeOpacity={0.8} style={styles.headerAvatarWrap}>
          <View style={[
            styles.headerAvatar,
            activeBorder?.id !== 'none' && { borderWidth: 2.5, borderColor: activeBorder?.borderColor, shadowColor: activeBorder?.shadowColor, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 6 }
          ]}>
            {profileImage
              ? <Image source={{ uri: profileImage }} style={styles.headerAvatarImg} />
              : <Text style={styles.headerAvatarInitials}>{initials}</Text>
            }
          </View>
          <View style={styles.editPen}><Text style={{ fontSize: 9 }}>✏️</Text></View>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Chats</Text>

        <TouchableOpacity style={styles.newChatBtn} onPress={() => setActionModal(true)} activeOpacity={0.85}>
          <Text style={styles.newChatBtnText}>＋</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Search ── */}
      <Animated.View style={[styles.searchWrap, { opacity: fadeAnim }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search contacts..." placeholderTextColor="rgba(107,107,138,0.5)" value={searchText} onChangeText={setSearchText} autoCorrect={false} autoCapitalize="none" />
        {searchText.length > 0 && <TouchableOpacity onPress={() => setSearchText('')}><Text style={styles.searchClear}>✕</Text></TouchableOpacity>}
      </Animated.View>

      {/* ── Filter chips ── */}
      <Animated.View style={[styles.filtersRow, { opacity: fadeAnim }]}>
        {filters.map(f => (
          <TouchableOpacity key={f} onPress={() => setActiveFilter(f)} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} activeOpacity={0.8}>
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* ── Contact list ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B5EA7" />}
      >
        {loadingContacts ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#7B5EA7" />
            <Text style={styles.emptySub}>Loading your contacts...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptySub}>Add friends using their VibeCode</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setActionModal(true)}>
              <Text style={styles.emptyBtnText}>+ Add your first contact</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(contact => {
            const initials2 = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <Animated.View key={contact.id} style={{ opacity: fadeAnim }}>
                <TouchableOpacity style={styles.contactInner} activeOpacity={0.7} onPress={() => handleContactPress(contact)}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarInitials}>{initials2}</Text>
                    </View>
                  </View>
                  <View style={styles.contactContent}>
                    <View style={styles.contactTop}>
                      <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
                      <Text style={[styles.contactTime, contact.unread > 0 && styles.contactTimeUnread]}>
                        {formatTime(contact.last_time)}
                      </Text>
                    </View>
                    <View style={styles.contactBottom}>
                      <Text style={[styles.contactLastMsg, contact.unread > 0 && styles.contactLastMsgBold]} numberOfLines={1}>
                        {contact.last_msg}
                      </Text>
                      {contact.unread > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{contact.unread}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* ── ACTION PICKER MODAL ── */}
      <Modal visible={actionModal} transparent animationType="slide" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>What do you want to do?</Text>

            <TouchableOpacity style={styles.actionOption} activeOpacity={0.8}
              onPress={() => { setActionModal(false); navigation.navigate('CreateGroup', { displayName, profileImage, token }); }}>
              <View style={styles.actionOptionIcon}><Text style={{ fontSize: 24 }}>⭐</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionOptionTitle}>Create a Fun-Star</Text>
                <Text style={styles.actionOptionSub}>Start a group with your crew</Text>
              </View>
              <Text style={styles.actionOptionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionOption} activeOpacity={0.8}
              onPress={() => { setActionModal(false); setAddModalVisible(true); }}>
              <View style={styles.actionOptionIcon}><Text style={{ fontSize: 24 }}>👤</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionOptionTitle}>Add a contact</Text>
                <Text style={styles.actionOptionSub}>Enter their VibeCode to connect</Text>
              </View>
              <Text style={styles.actionOptionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ADD CONTACT MODAL ── */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a contact</Text>
            <Text style={styles.modalSub}>Enter their VibeCode to connect</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. VibeAB123"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={codeInput}
              onChangeText={setCodeInput}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btnPrimary, (!codeInput.trim() || addingContact) && styles.btnDisabled]}
              activeOpacity={0.85}
              onPress={handleAddContact}
              disabled={addingContact}
            >
              {addingContact
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Add Contact ✦</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setAddModalVisible(false); setCodeInput(''); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── PROFILE MODAL ── */}
      <Modal visible={profileModalVisible} transparent animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 48 }]}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.profileAvatarSection}>
                <TouchableOpacity onPress={pickEditImage} activeOpacity={0.85}>
                  <View style={[
                    styles.profileAvatarLarge,
                    editActiveBorder?.id !== 'none' && { borderWidth: 3.5, borderColor: editActiveBorder?.borderColor, shadowColor: editActiveBorder?.shadowColor, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10 }
                  ]}>
                    {editImage
                      ? <Image source={{ uri: editImage }} style={styles.profileAvatarLargeImg} />
                      : <Text style={styles.profileAvatarInitials}>{initials}</Text>
                    }
                  </View>
                  <View style={styles.changePhotoBtn}><Text style={styles.changePhotoBtnText}>📷 Change photo</Text></View>
                </TouchableOpacity>
              </View>

              <View style={styles.vibeCodeRow}>
                <Text style={styles.vibeCodeRowLabel}>VIBE CODE</Text>
                <Text style={styles.vibeCodeRowValue}>{vibeCode}</Text>
              </View>

              {selectedTags.length > 0 && (
                <View style={styles.tagsRow}>
                  {selectedTags.map(tag => (
                    <View key={tag} style={styles.tagChipDisplay}><Text style={styles.tagChipDisplayText}>{tag}</Text></View>
                  ))}
                </View>
              )}

              {selectedVibe && (
                <Text style={styles.vibeDisplay}>
                  {selectedVibe === 'fun' ? '😂 Here for fun' : selectedVibe === 'connect' ? '🤝 Reconnect' : selectedVibe === 'chaos' ? '🔥 Chaos mode' : '😌 Keep it chill'}
                </Text>
              )}

              <View style={styles.sectionDivider} />

              <Text style={styles.editLabel}>DISPLAY NAME</Text>
              {canEditName ? (
                <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Your display name" placeholderTextColor="rgba(107,107,138,0.5)" autoCapitalize="words" autoCorrect={false} />
              ) : (
                <View style={styles.lockedField}>
                  <Text style={styles.lockedFieldText}>{displayName}</Text>
                  <View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>🔒 Editable in {daysUntilEdit} days</Text></View>
                </View>
              )}
              {canEditName && <Text style={styles.nameChangeNote}>⚠ Changing your name also updates your VibeCode. Once changed, you must wait 30 days to change again.</Text>}

              <Text style={[styles.editLabel, { marginTop: 16 }]}>BIO</Text>
              <TextInput style={[styles.editInput, styles.editBioInput]} value={editBio} onChangeText={setEditBio} placeholder="A little something about you..." placeholderTextColor="rgba(107,107,138,0.5)" multiline maxLength={120} autoCorrect={false} />
              <Text style={styles.charCount}>{editBio.length}/120</Text>

              <Text style={[styles.editLabel, { marginTop: 8 }]}>PROFILE RING</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {AVATAR_BORDERS.map(border => (
                  <TouchableOpacity key={border.id} onPress={() => setEditBorder(border.id)}
                    style={[styles.borderOption, editBorder === border.id && styles.borderOptionActive, border.id !== 'none' && { borderColor: border.borderColor + '60' }]}>
                    <Text style={styles.borderOptionText}>{border.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={saveProfile}>
                <Text style={styles.btnPrimaryText}>Save changes ✦</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnSignOut, { marginTop: 12 }]} activeOpacity={0.7}
                onPress={() => { setProfileModalVisible(false); navigation.navigate('Login'); }}>
                <Text style={styles.btnSignOutText}>🚪 Sign out</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCancel} onPress={() => setProfileModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  blobTop: { position: 'absolute', top: -80, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(179,157,219,0.1)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarInitials: { color: '#fff', fontSize: 15, fontWeight: '600' },
  editPen: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  headerTitle: { fontStyle: 'italic', fontSize: 26, color: '#1A1A2E', fontWeight: '300', letterSpacing: -0.5 },
  newChatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', shadowColor: '#7B5EA7', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  newChatBtnText: { color: '#fff', fontSize: 22, lineHeight: 26, fontWeight: '300' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, backgroundColor: '#F0EFF8', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E', padding: 0 },
  searchClear: { fontSize: 13, color: '#6B6B8A', paddingHorizontal: 4 },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 6 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0EFF8', borderWidth: 1.5, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: 'rgba(123,94,167,0.12)', borderColor: '#7B5EA7' },
  filterChipText: { fontSize: 13, color: '#6B6B8A' },
  filterChipTextActive: { color: '#7B5EA7', fontWeight: '600' },
  listContainer: { paddingBottom: 40 },
  contactInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 14 },
  divider: { height: 1, backgroundColor: 'rgba(107,107,138,0.07)', marginLeft: 88 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 18, fontWeight: '600' },
  contactContent: { flex: 1 },
  contactTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  contactName: { fontSize: 16, color: '#1A1A2E', fontWeight: '500', flex: 1 },
  contactTime: { fontSize: 12, color: '#6B6B8A' },
  contactTimeUnread: { color: '#7B5EA7', fontWeight: '600' },
  contactBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactLastMsg: { fontSize: 13, color: '#6B6B8A', flex: 1 },
  contactLastMsgBold: { color: '#1A1A2E', fontWeight: '500' },
  unreadBadge: { backgroundColor: '#7B5EA7', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontStyle: 'italic', fontSize: 22, color: '#1A1A2E', fontWeight: '300' },
  emptySub: { fontSize: 14, color: '#6B6B8A', marginBottom: 12 },
  emptyBtn: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 13 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,46,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FAFAF8', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 36, maxHeight: '92%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(107,107,138,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontStyle: 'italic', fontSize: 26, color: '#1A1A2E', fontWeight: '300', textAlign: 'center', marginBottom: 20 },
  modalSub: { fontSize: 14, color: '#6B6B8A', textAlign: 'center', marginBottom: 24, fontStyle: 'italic' },
  modalInput: { backgroundColor: '#F0EFF8', borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', padding: 16, fontSize: 18, color: '#1A1A2E', textAlign: 'center', letterSpacing: 2, fontWeight: '600', marginBottom: 16 },
  modalCancel: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 15, color: '#6B6B8A', fontStyle: 'italic' },
  actionOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.1)', marginBottom: 10, gap: 14 },
  actionOptionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(123,94,167,0.08)', alignItems: 'center', justifyContent: 'center' },
  actionOptionTitle: { fontSize: 16, color: '#1A1A2E', fontWeight: '500' },
  actionOptionSub: { fontSize: 12, color: '#6B6B8A', marginTop: 2 },
  actionOptionArrow: { fontSize: 22, color: '#B39DDB' },
  profileAvatarSection: { alignItems: 'center', marginBottom: 16 },
  profileAvatarLarge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileAvatarLargeImg: { width: 90, height: 90, borderRadius: 45 },
  profileAvatarInitials: { color: '#fff', fontSize: 30, fontWeight: '600' },
  changePhotoBtn: { alignItems: 'center', marginTop: 8 },
  changePhotoBtnText: { fontSize: 13, color: '#7B5EA7', fontStyle: 'italic' },
  vibeCodeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 14 },
  vibeCodeRowLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: '#B39DDB' },
  vibeCodeRowValue: { fontSize: 15, color: '#7B5EA7', fontWeight: '700', letterSpacing: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 },
  tagChipDisplay: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(123,94,167,0.1)', borderWidth: 1, borderColor: 'rgba(123,94,167,0.2)' },
  tagChipDisplayText: { fontSize: 12, color: '#7B5EA7' },
  vibeDisplay: { textAlign: 'center', fontSize: 14, color: '#6B6B8A', fontStyle: 'italic', marginBottom: 8 },
  sectionDivider: { height: 1, backgroundColor: 'rgba(107,107,138,0.1)', marginVertical: 16 },
  editLabel: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', marginBottom: 6, marginLeft: 4, fontWeight: '500' },
  editInput: { backgroundColor: '#F0EFF8', borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', padding: 14, fontSize: 15, color: '#1A1A2E', fontStyle: 'italic', marginBottom: 4 },
  editBioInput: { height: 80, textAlignVertical: 'top', paddingTop: 14 },
  charCount: { fontSize: 11, color: 'rgba(107,107,138,0.5)', alignSelf: 'flex-end', marginBottom: 4 },
  lockedField: { backgroundColor: '#F0EFF8', borderRadius: 14, padding: 14, marginBottom: 8, gap: 6 },
  lockedFieldText: { fontSize: 15, color: '#1A1A2E' },
  lockedBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  lockedBadgeText: { fontSize: 11, color: '#FF6B6B' },
  nameChangeNote: { fontSize: 11, color: '#6B6B8A', fontStyle: 'italic', marginBottom: 12, lineHeight: 16 },
  borderOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.15)', marginRight: 8, backgroundColor: '#fff' },
  borderOptionActive: { backgroundColor: 'rgba(123,94,167,0.1)', borderColor: '#7B5EA7' },
  borderOptionText: { fontSize: 13, color: '#1A1A2E' },
  btnPrimary: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5, marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '500', letterSpacing: 0.3 },
  btnDisabled: { backgroundColor: 'rgba(107,107,138,0.2)', shadowOpacity: 0, elevation: 0 },
  btnSignOut: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.05)' },
  btnSignOutText: { fontSize: 15, color: '#FF6B6B' },
});