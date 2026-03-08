import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, ActivityIndicator,
  Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';

// Typing animation for group name
function TypingGroupName({ value }) {
  const [displayed, setDisplayed] = useState('');
  const [cursor,    setCursor]    = useState(true);

  useEffect(() => {
    setDisplayed('');
    if (!value) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(value.slice(0, i + 1));
      i++;
      if (i >= value.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [value]);

  useEffect(() => {
    const blink = setInterval(() => setCursor(c => !c), 500);
    return () => clearInterval(blink);
  }, []);

  if (!value) return null;

  return (
    <View style={styles.typingPreviewWrap}>
      <Text style={styles.typingPreviewText}>
        {displayed}
        <Text style={{ opacity: cursor ? 1 : 0, color: '#7B5EA7' }}>|</Text>
      </Text>
    </View>
  );
}

export default function CreateGroupScreen({ navigation, route }) {
  const { token, displayName, profileImage } = route.params;

  const [step,           setStep]           = useState(1); // 1: name+image, 2: members
  const [groupName,      setGroupName]      = useState('');
  const [groupImage,     setGroupImage]     = useState(null);
  const [contacts,       setContacts]       = useState([]);
  const [loadingContacts,setLoadingContacts]= useState(true);
  const [selected,       setSelected]       = useState([]); // array of contact ids
  const [creating,       setCreating]       = useState(false);
  const [nameConfirmed,  setNameConfirmed]  = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const nameInput = useRef(null);

  useEffect(() => {
    animateIn();
    loadContacts();
  }, []);

  useEffect(() => {
    animateIn();
  }, [step]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const a = { opacity: fadeAnim, transform: [{ translateY: slideAnim }] };

  const loadContacts = async () => {
    try {
      const data = await api.getContacts(token);
      setContacts(data.contacts || []);
    } catch (err) {
      console.log('Error loading contacts:', err.message);
    } finally {
      setLoadingContacts(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled) {
      setGroupImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const confirmName = () => {
    if (!groupName.trim()) { Alert.alert('', 'Give your Vibe Chat a name first!'); return; }
    setNameConfirmed(true);
    setTimeout(() => setStep(2), 800);
  };

  const toggleContact = (id) => {
    if (selected.includes(id)) setSelected(selected.filter(s => s !== id));
    else setSelected([...selected, id]);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { Alert.alert('', 'Name your group first'); return; }
    setCreating(true);
    try {
      const data = await api.createGroup(token, groupName.trim(), groupImage || '', selected);
      navigation.replace('GroupChat', {
        groupId:     data.group.id,
        groupName:   data.group.name,
        groupImage:  data.group.image,
        ownerId:     data.group.owner_id,
        token,
        displayName,
        profileImage,
      });
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  };

  const groupInitials = groupName.slice(0, 2).toUpperCase() || 'VC';

  // ── STEP 1: Name + Image ─────────────────────────────────────────
  const renderStep1 = () => (
    <Animated.View style={[{ flex: 1 }, a]}>
      <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
      <Text style={styles.pageTitle}>Create a{'\n'}Vibe Chat</Text>
      <Text style={styles.pageSub}>Name it, give it a look</Text>

      {/* Group image picker */}
      <TouchableOpacity style={styles.groupImageWrap} onPress={pickImage} activeOpacity={0.85}>
        {groupImage
          ? <Image source={{ uri: groupImage }} style={styles.groupImage} resizeMode="cover" />
          : <View style={styles.groupImagePlaceholder}>
              <Text style={styles.groupImageInitials}>{groupInitials}</Text>
              <Text style={styles.groupImageHint}>📷 tap to add photo</Text>
            </View>
        }
        <View style={styles.groupImageEditBadge}>
          <Text style={{ fontSize: 14 }}>📷</Text>
        </View>
      </TouchableOpacity>

      {/* Typing animation preview */}
      <TypingGroupName value={nameConfirmed ? groupName : ''} />

      {/* Name input */}
      <Text style={styles.label}>VIBE CHAT NAME</Text>
      <TextInput
        ref={nameInput}
        style={styles.nameInput}
        placeholder="e.g. Weekend Chaos 🔥"
        placeholderTextColor="rgba(107,107,138,0.4)"
        value={groupName}
        onChangeText={(v) => { setGroupName(v); setNameConfirmed(false); }}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={confirmName}
      />
      <Text style={styles.charCount}>{groupName.length}/40</Text>

      <TouchableOpacity
        style={[styles.btnPrimary, !groupName.trim() && styles.btnDisabled]}
        onPress={confirmName}
        activeOpacity={0.85}
        disabled={!groupName.trim()}
      >
        <Text style={styles.btnPrimaryText}>Next → Pick members</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── STEP 2: Members ──────────────────────────────────────────────
  const renderStep2 = () => (
    <Animated.View style={[{ flex: 1 }, a]}>
      <TouchableOpacity style={styles.backRow} onPress={() => setStep(1)}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.stepLabel}>STEP 2 OF 2</Text>

      {/* Group preview header */}
      <View style={styles.groupPreviewRow}>
        <View style={styles.groupPreviewAvatar}>
          {groupImage
            ? <Image source={{ uri: groupImage }} style={styles.groupPreviewAvatarImg} />
            : <Text style={styles.groupPreviewAvatarText}>{groupInitials}</Text>
          }
        </View>
        <View>
          <Text style={styles.groupPreviewName}>{groupName}</Text>
          <Text style={styles.groupPreviewSub}>{selected.length} member{selected.length !== 1 ? 's' : ''} invited</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>INVITE FROM YOUR CONTACTS</Text>
      <Text style={styles.sectionSub}>They'll receive an invite and can accept or decline</Text>

      {loadingContacts ? (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <ActivityIndicator color="#7B5EA7" />
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.noContacts}>
          <Text style={styles.noContactsEmoji}>👥</Text>
          <Text style={styles.noContactsText}>No contacts yet</Text>
          <Text style={styles.noContactsSub}>Add friends first to invite them</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {contacts.map(contact => {
            const isSelected = selected.includes(contact.id);
            const ci = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <TouchableOpacity
                key={contact.id}
                style={[styles.contactRow, isSelected && styles.contactRowSelected]}
                onPress={() => toggleContact(contact.id)}
                activeOpacity={0.75}
              >
                <View style={styles.contactAvatar}>
                  {contact.profile_image
                    ? <Image source={{ uri: contact.profile_image }} style={styles.contactAvatarImg} />
                    : <Text style={styles.contactAvatarText}>{ci}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactCode}>{contact.vibe_code}</Text>
                </View>
                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.btnPrimary, { flex: 1 }, creating && styles.btnDisabled]}
          onPress={handleCreate}
          activeOpacity={0.85}
          disabled={creating}
        >
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>
                {selected.length > 0
                  ? `Create & invite ${selected.length} 🚀`
                  : 'Create group 🚀'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
          </View>
          {step === 1 ? renderStep1() : renderStep2()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  blob1: { position:'absolute', top:-80, left:-60, width:260, height:260, borderRadius:130, backgroundColor:'rgba(179,157,219,0.12)' },
  blob2: { position:'absolute', bottom:-60, right:-80, width:240, height:240, borderRadius:120, backgroundColor:'rgba(0,212,255,0.07)' },
  container: { flex:1, paddingHorizontal:28, paddingTop:8, paddingBottom:0 },
  progressBar: { height:3, backgroundColor:'rgba(123,94,167,0.1)', borderRadius:2, marginBottom:20, overflow:'hidden' },
  progressFill: { height:'100%', backgroundColor:'#7B5EA7', borderRadius:2 },

  stepLabel: { fontSize:11, letterSpacing:1.2, textTransform:'uppercase', color:'#B39DDB', fontWeight:'600', marginBottom:6 },
  pageTitle: { fontStyle:'italic', fontSize:38, color:'#1A1A2E', fontWeight:'300', letterSpacing:-1, lineHeight:44, marginBottom:6 },
  pageSub: { fontSize:14, color:'#6B6B8A', marginBottom:28 },

  groupImageWrap: { alignSelf:'center', position:'relative', marginBottom:24 },
  groupImage: { width:110, height:110, borderRadius:28, borderWidth:3, borderColor:'rgba(123,94,167,0.3)', overflow:'hidden' },
  groupImageWrapInner: { width:110, height:110, borderRadius:28, overflow:'hidden' },
  groupImagePlaceholder: { width:110, height:110, borderRadius:28, backgroundColor:'rgba(123,94,167,0.1)', borderWidth:2, borderColor:'rgba(123,94,167,0.2)', borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:4 },
  groupImageInitials: { fontSize:28, fontWeight:'700', color:'#7B5EA7' },
  groupImageHint: { fontSize:11, color:'#B39DDB', fontStyle:'italic' },
  groupImageEditBadge: { position:'absolute', bottom:-4, right:-4, width:30, height:30, borderRadius:15, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.12, shadowRadius:4, elevation:3 },

  typingPreviewWrap: { alignItems:'center', marginBottom:16 },
  typingPreviewText: { fontStyle:'italic', fontSize:22, color:'#1A1A2E', fontWeight:'300', letterSpacing:-0.5 },

  label: { fontSize:11, letterSpacing:0.9, textTransform:'uppercase', color:'#6B6B8A', marginBottom:8, marginLeft:2, fontWeight:'500' },
  nameInput: { backgroundColor:'#F0EFF8', borderRadius:16, borderWidth:1.5, borderColor:'transparent', padding:16, fontSize:20, color:'#1A1A2E', fontStyle:'italic', fontWeight:'300', marginBottom:4 },
  charCount: { fontSize:11, color:'rgba(107,107,138,0.4)', alignSelf:'flex-end', marginBottom:20 },

  btnPrimary: { backgroundColor:'#1A1A2E', borderRadius:16, paddingVertical:17, alignItems:'center', shadowColor:'#1A1A2E', shadowOffset:{width:0,height:6}, shadowOpacity:0.22, shadowRadius:14, elevation:5 },
  btnPrimaryText: { color:'#fff', fontSize:16, fontWeight:'500', letterSpacing:0.3 },
  btnDisabled: { backgroundColor:'rgba(107,107,138,0.2)', shadowOpacity:0, elevation:0 },
  cancelBtn: { alignItems:'center', paddingVertical:14 },
  cancelBtnText: { fontSize:14, color:'#6B6B8A', fontStyle:'italic' },

  backRow: { paddingVertical:8, marginBottom:4 },
  backText: { fontSize:14, color:'#6B6B8A', fontStyle:'italic' },

  groupPreviewRow: { flexDirection:'row', alignItems:'center', gap:14, marginBottom:24, backgroundColor:'rgba(123,94,167,0.06)', borderRadius:18, padding:14 },
  groupPreviewAvatar: { width:52, height:52, borderRadius:14, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  groupPreviewAvatarImg: { width:52, height:52, borderRadius:14 },
  groupPreviewAvatarText: { color:'#fff', fontSize:18, fontWeight:'700' },
  groupPreviewName: { fontSize:18, color:'#1A1A2E', fontWeight:'500', fontStyle:'italic' },
  groupPreviewSub: { fontSize:12, color:'#B39DDB', marginTop:2 },

  sectionTitle: { fontSize:11, letterSpacing:0.9, textTransform:'uppercase', color:'#6B6B8A', fontWeight:'600', marginBottom:4 },
  sectionSub: { fontSize:12, color:'#B39DDB', fontStyle:'italic', marginBottom:16 },

  noContacts: { alignItems:'center', paddingVertical:40, gap:8 },
  noContactsEmoji: { fontSize:40 },
  noContactsText: { fontSize:16, color:'#1A1A2E', fontStyle:'italic' },
  noContactsSub: { fontSize:13, color:'#6B6B8A' },

  contactRow: { flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:4, borderRadius:16, marginBottom:4, gap:12 },
  contactRowSelected: { backgroundColor:'rgba(123,94,167,0.08)' },
  contactAvatar: { width:48, height:48, borderRadius:24, backgroundColor:'#7B5EA7', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  contactAvatarImg: { width:48, height:48, borderRadius:24 },
  contactAvatarText: { color:'#fff', fontSize:16, fontWeight:'600' },
  contactName: { fontSize:15, color:'#1A1A2E', fontWeight:'500' },
  contactCode: { fontSize:11, color:'#B39DDB', letterSpacing:0.5, marginTop:1 },
  checkCircle: { width:26, height:26, borderRadius:13, borderWidth:2, borderColor:'rgba(107,107,138,0.3)', alignItems:'center', justifyContent:'center' },
  checkCircleSelected: { backgroundColor:'#7B5EA7', borderColor:'#7B5EA7' },
  checkMark: { color:'#fff', fontSize:14, fontWeight:'700' },

  bottomBar: { position:'absolute', bottom:24, left:28, right:28 },
});