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

export default function HomeScreen({ navigation, route }) {
  const token = route?.params?.token || '';
  // NOTE: LoginScreen and RegisterScreen must pass { token, user } to Home

  // Profile state — loaded from server on login
  const [user,           setUser]           = useState(route?.params?.user || null);
  const [displayName,    setDisplayName]    = useState(
    route?.params?.user ? `${route.params.user.first_name} ${route.params.user.last_name}`.trim() : 'You'
  );
  const [vibeCode,       setVibeCode]       = useState(route?.params?.user?.vibe_code       || 'VibeXXX');
  const [profileImage,   setProfileImage]   = useState(route?.params?.user?.profile_image   || null);
  const [selectedBorder, setSelectedBorder] = useState(route?.params?.user?.profile_border  || 'glow_purple');
  const [bio,            setBio]            = useState(route?.params?.user?.bio              || '');
  const [vibeTags]                          = useState(route?.params?.user?.vibe_tags        || '');
  const [mainVibe]                          = useState(route?.params?.user?.main_vibe        || '');

  // Edit modal
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editName,            setEditName]            = useState(displayName);
  const [editBio,             setEditBio]             = useState(bio);
  const [editBorder,          setEditBorder]          = useState(selectedBorder);
  const [editImage,           setEditImage]           = useState(profileImage);
  const [savingProfile,       setSavingProfile]       = useState(false);

  // Name change lock
  const nameChangedAt   = route?.params?.user?.name_changed_at || null;
  const daysSinceChange = nameChangedAt
    ? Math.floor((Date.now() - new Date(nameChangedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const canEditName   = daysSinceChange >= 30;
  const daysUntilEdit = 30 - daysSinceChange;

  // Contacts & requests
  const [contacts,        setContacts]        = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [friendRequests,  setFriendRequests]  = useState([]);
  const [requestsModal,   setRequestsModal]   = useState(false);
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

  useFocusEffect(useCallback(() => {
    loadContacts();
    loadFriendRequests();
  }, [token]));

  const loadContacts = async () => {
    if (!token) return;
    try {
      const data = await api.getContacts(token);
      setContacts(data.contacts || []);
    } catch (err) {
      console.log('Contacts error:', err.message);
    } finally {
      setLoadingContacts(false);
      setRefreshing(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!token) return;
    try {
      const data = await api.getFriendRequests(token);
      setFriendRequests(data.requests || []);
    } catch (err) {
      console.log('Requests error:', err.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
    loadFriendRequests();
  };

  // ── Save profile to backend ────────────────────────────────────
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates = {
        bio:            editBio,
        profile_border: editBorder,
        profile_image:  editImage || '',
      };
      if (editName !== displayName) {
        updates.display_name = editName;
      }
      const data = await api.updateProfile(token, updates);
      const u    = data.user;
      setDisplayName(`${u.first_name} ${u.last_name}`.trim());
      setVibeCode(u.vibe_code);
      setProfileImage(u.profile_image || null);
      setSelectedBorder(u.profile_border || 'glow_purple');
      setBio(u.bio || '');
      setProfileModalVisible(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfileModal = () => {
    setEditBio(bio);
    setEditName(displayName);
    setEditBorder(selectedBorder);
    setEditImage(profileImage);
    setProfileModalVisible(true);
  };

  const pickEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5,
      base64: true,
    });
    if (!result.canceled) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setEditImage(base64);
    }
  };

  // ── Friend requests ────────────────────────────────────────────
  const handleSendRequest = async () => {
    const trimmed = codeInput.trim();
    if (!trimmed.startsWith('Vibe') || trimmed.length < 7) {
      Alert.alert('Invalid code', 'Enter a valid VibeCode (e.g. VibeAB123)');
      return;
    }
    setAddingContact(true);
    try {
      const data = await api.sendFriendRequest(token, trimmed);
      setCodeInput('');
      setAddModalVisible(false);
      if (data.auto_accepted) {
        Alert.alert('🎉 Connected!', data.message);
        loadContacts();
      } else {
        Alert.alert('📨 Request sent!', data.message);
      }
    } catch (err) {
      Alert.alert('Oops', err.message);
    } finally {
      setAddingContact(false);
    }
  };

  const handleRespond = async (requestId, action) => {
    try {
      await api.respondToRequest(token, requestId, action);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'accept') {
        loadContacts();
        Alert.alert('🎉 Connected!', 'You are now friends!');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleContactPress = (contact) => {
    navigation.navigate('Chat', {
      contactId:      contact.id,
      contactName:    contact.name,
      vibeCode:       contact.vibe_code,
      profileImage:   contact.profile_image,
      profileBorder:  contact.profile_border,
      token,
      displayName,
    });
  };

  const formatTime = (t) => {
    if (!t) return '';
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const filters        = ['All', 'Unread'];
  const filtered       = contacts.filter(c => {
    const match = c.name.toLowerCase().includes(searchText.toLowerCase());
    if (activeFilter === 'Unread') return match && c.unread > 0;
    return match;
  });

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
            activeBorder?.id !== 'none' && {
              borderWidth: 2.5, borderColor: activeBorder?.borderColor,
              shadowColor: activeBorder?.shadowColor, shadowOpacity: 0.6,
              shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 6
            }
          ]}>
            {profileImage
              ? <Image source={{ uri: profileImage }} style={styles.headerAvatarImg} />
              : <Text style={styles.headerAvatarInitials}>{initials}</Text>
            }
          </View>
          <View style={styles.editPen}><Text style={{ fontSize: 9 }}>✏️</Text></View>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Chats</Text>

        <View style={styles.headerRight}>
          {/* Friend requests bell */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => { loadFriendRequests(); setRequestsModal(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.bellBtnText}>🔔</Text>
            {friendRequests.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{friendRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.newChatBtn} onPress={() => setActionModal(true)} activeOpacity={0.85}>
            <Text style={styles.newChatBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Search ── */}
      <Animated.View style={[styles.searchWrap, { opacity: fadeAnim }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search contacts..." placeholderTextColor="rgba(107,107,138,0.5)" value={searchText} onChangeText={setSearchText} autoCorrect={false} autoCapitalize="none" />
        {searchText.length > 0 && <TouchableOpacity onPress={() => setSearchText('')}><Text style={styles.searchClear}>✕</Text></TouchableOpacity>}
      </Animated.View>

      {/* ── Filters ── */}
      <Animated.View style={[styles.filtersRow, { opacity: fadeAnim }]}>
        {filters.map(f => (
          <TouchableOpacity key={f} onPress={() => setActiveFilter(f)}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} activeOpacity={0.8}>
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* ── Contacts list ── */}
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
            const ci = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const cb = AVATAR_BORDERS.find(b => b.id === contact.profile_border);
            return (
              <Animated.View key={contact.id} style={{ opacity: fadeAnim }}>
                <TouchableOpacity style={styles.contactInner} activeOpacity={0.7} onPress={() => handleContactPress(contact)}>
                  <View style={styles.avatarWrap}>
                    <View style={[
                      styles.avatar,
                      cb?.id !== 'none' && { borderWidth: 2, borderColor: cb?.borderColor }
                    ]}>
                      {contact.profile_image
                        ? <Image source={{ uri: contact.profile_image }} style={styles.avatarImg} />
                        : <Text style={styles.avatarInitials}>{ci}</Text>
                      }
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
                        <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{contact.unread}</Text></View>
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

      {/* ── FRIEND REQUESTS MODAL ── */}
      <Modal visible={requestsModal} transparent animationType="slide" onRequestClose={() => setRequestsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Friend Requests</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {friendRequests.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🔔</Text>
                  <Text style={{ fontSize: 15, color: '#6B6B8A', fontStyle: 'italic' }}>No pending requests</Text>
                </View>
              ) : (
                friendRequests.map(req => {
                  const ri = req.sender_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <View key={req.id} style={styles.requestRow}>
                      <View style={styles.requestAvatar}>
                        {req.profile_image
                          ? <Image source={{ uri: req.profile_image }} style={styles.requestAvatarImg} />
                          : <Text style={styles.requestAvatarText}>{ri}</Text>
                        }
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestName}>{req.sender_name}</Text>
                        <Text style={styles.requestCode}>{req.vibe_code}</Text>
                        {req.bio ? <Text style={styles.requestBio} numberOfLines={1}>{req.bio}</Text> : null}
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(req.id, 'accept')}>
                          <Text style={styles.acceptBtnText}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(req.id, 'decline')}>
                          <Text style={styles.declineBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setRequestsModal(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                <Text style={styles.actionOptionSub}>Send a friend request via VibeCode</Text>
              </View>
              <Text style={styles.actionOptionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ADD CONTACT (send friend request) MODAL ── */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Send friend request</Text>
            <Text style={styles.modalSub}>Enter their VibeCode — they'll get a notification to accept</Text>
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
              onPress={handleSendRequest}
              disabled={addingContact}
            >
              {addingContact
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Send request 📨</Text>
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
                    editActiveBorder?.id !== 'none' && {
                      borderWidth: 3.5, borderColor: editActiveBorder?.borderColor,
                      shadowColor: editActiveBorder?.shadowColor, shadowOpacity: 0.55,
                      shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10
                    }
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

              <View style={styles.sectionDivider} />

              <Text style={styles.editLabel}>DISPLAY NAME</Text>
              {canEditName ? (
                <TextInput style={styles.editInput} value={editName} onChangeText={setEditName}
                  placeholder="Your display name" placeholderTextColor="rgba(107,107,138,0.5)"
                  autoCapitalize="words" autoCorrect={false} />
              ) : (
                <View style={styles.lockedField}>
                  <Text style={styles.lockedFieldText}>{displayName}</Text>
                  <View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>🔒 Editable in {daysUntilEdit} days</Text></View>
                </View>
              )}
              {canEditName && <Text style={styles.nameChangeNote}>⚠ Changing your name also updates your VibeCode. 30-day cooldown applies.</Text>}

              <Text style={[styles.editLabel, { marginTop: 16 }]}>BIO</Text>
              <TextInput style={[styles.editInput, styles.editBioInput]} value={editBio} onChangeText={setEditBio}
                placeholder="A little something about you..." placeholderTextColor="rgba(107,107,138,0.5)"
                multiline maxLength={120} autoCorrect={false} />
              <Text style={styles.charCount}>{editBio.length}/120</Text>

              <Text style={[styles.editLabel, { marginTop: 8 }]}>PROFILE RING</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {AVATAR_BORDERS.map(border => (
                  <TouchableOpacity key={border.id} onPress={() => setEditBorder(border.id)}
                    style={[styles.borderOption, editBorder === border.id && styles.borderOptionActive,
                      border.id !== 'none' && { borderColor: border.borderColor + '60' }]}>
                    <Text style={styles.borderOptionText}>{border.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.btnPrimary, savingProfile && styles.btnDisabled]}
                activeOpacity={0.85}
                onPress={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Save changes ✦</Text>
                }
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellBtnText: { fontSize: 18 },
  bellBadge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B6B', alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
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
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(107,107,138,0.08)', gap: 12 },
  requestAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  requestAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  requestAvatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  requestName: { fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  requestCode: { fontSize: 11, color: '#B39DDB', letterSpacing: 0.5 },
  requestBio: { fontSize: 12, color: '#6B6B8A', fontStyle: 'italic', marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7B5EA7', alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  declineBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,107,107,0.3)', alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
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