import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, TextInput,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';

const AVATAR_BORDERS = [
  { id: 'none',        label: 'None',      borderColor: 'transparent', shadowColor: 'transparent' },
  { id: 'glow_blue',   label: '💙 Blue',   borderColor: '#00D4FF',     shadowColor: '#00D4FF' },
  { id: 'glow_pink',   label: '💗 Pink',   borderColor: '#FF69B4',     shadowColor: '#FF69B4' },
  { id: 'glow_purple', label: '💜 Purple', borderColor: '#7B5EA7',     shadowColor: '#7B5EA7' },
  { id: 'glow_gold',   label: '✨ Gold',   borderColor: '#FFD700',     shadowColor: '#FFD700' },
];

const EMOJI_TAGS = [
  '🌶️ Spicy', '🎮 Gamer', '🍜 Foodie', '🎵 Music',
  '📸 Snap',  '🏋️ Gym',   '✈️ Travel', '🎨 Art',
  '📚 Books', '🌙 Night owl', '☕ Coffee', '🐾 Pet lover',
];

const VIBES = [
  { id: 'fun',     label: '😂 Here for fun'  },
  { id: 'connect', label: '🤝 Reconnect'      },
  { id: 'chaos',   label: '🔥 Chaos mode'     },
  { id: 'chill',   label: '😌 Keep it chill'  },
];

export default function ProfileSetupScreen({ navigation, route }) {
  const token     = route?.params?.token || '';
  const userParam = route?.params?.user  || null;

  const firstName = route?.params?.firstName || userParam?.first_name || '';
  const lastName  = route?.params?.lastName  || userParam?.last_name  || '';
  const fullName  = `${firstName} ${lastName}`.trim();

  const [displayName,    setDisplayName]    = useState(fullName);
  const [bio,            setBio]            = useState('');
  const [profileImage,   setProfileImage]   = useState(null);  // base64 string
  const [selectedBorder, setSelectedBorder] = useState('glow_purple');
  const [selectedTags,   setSelectedTags]   = useState([]);
  const [selectedVibe,   setSelectedVibe]   = useState(null);
  const [step,           setStep]           = useState(1);
  const [saving,         setSaving]         = useState(false);

  const fadeAnims  = useRef([...Array(8)].map(() => new Animated.Value(0))).current;
  const slideAnims = useRef([...Array(8)].map(() => new Animated.Value(28))).current;

  useEffect(() => { animateIn(); }, [step]);

  const animateIn = () => {
    fadeAnims.forEach(a => a.setValue(0));
    slideAnims.forEach(a => a.setValue(28));
    fadeAnims.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim,          { toValue: 1, duration: 500, delay: i * 90, useNativeDriver: true }),
        Animated.timing(slideAnims[i], { toValue: 0, duration: 420, delay: i * 90, useNativeDriver: true }),
      ]).start();
    });
  };

  const a = (i) => ({ opacity: fadeAnims[i], transform: [{ translateY: slideAnims[i] }] });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5,
      base64: true,
    });
    if (!result.canceled) {
      setProfileImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) setSelectedTags(selectedTags.filter(t => t !== tag));
    else if (selectedTags.length < 5) setSelectedTags([...selectedTags, tag]);
  };

  const activeBorder = AVATAR_BORDERS.find(b => b.id === selectedBorder);

  // ── Save profile to backend then go to Home ─────────────────────
  const goToHome = async () => {
    setSaving(true);
    try {
      const updates = {
        display_name:   displayName,
        bio,
        profile_image:  profileImage || '',
        profile_border: selectedBorder,
        vibe_tags:      selectedTags.join(','),
        main_vibe:      selectedVibe || '',
      };
      const data = await api.updateProfile(token, updates);
      // Navigate with fresh user from server
      navigation.navigate('Home', {
        token,
        user: data.user,
      });
    } catch (err) {
      Alert.alert('Error saving profile', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── STEP 1 ──────────────────────────────────────────────────────
  const renderStep1 = () => (
    <>
      <Animated.View style={[styles.stepHeader, a(0)]}>
        <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
        <Text style={styles.stepTitle}>Set your vibe</Text>
        <Text style={styles.stepSub}>This is how your crew will see you</Text>
      </Animated.View>

      <Animated.View style={[styles.avatarSection, a(1)]}>
        <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
          <View style={[styles.avatarRing, activeBorder?.id !== 'none' && {
            borderColor: activeBorder?.borderColor, shadowColor: activeBorder?.shadowColor,
            shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10
          }]}>
            {profileImage
              ? <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              : <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarEmoji}>📸</Text>
                  <Text style={styles.avatarPlaceholderText}>Tap to add photo</Text>
                </View>
            }
          </View>
        </TouchableOpacity>
        <View style={styles.vibeCodeBadge}>
          <Text style={styles.vibeCodeText}>{userParam?.vibe_code || '...'}</Text>
        </View>
      </Animated.View>

      <Animated.View style={a(2)}>
        <Text style={styles.label}>PROFILE RING</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.borderScroll}>
          {AVATAR_BORDERS.map(border => (
            <TouchableOpacity key={border.id} onPress={() => setSelectedBorder(border.id)}
              style={[styles.borderOption, selectedBorder === border.id && styles.borderOptionActive,
                border.id !== 'none' && { borderColor: border.borderColor + '60' }]}>
              <Text style={styles.borderOptionText}>{border.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View style={a(3)}>
        <Text style={styles.label}>DISPLAY NAME</Text>
        <TextInput style={styles.input} placeholder="How your friends know you"
          placeholderTextColor="rgba(107,107,138,0.5)" value={displayName}
          onChangeText={setDisplayName} autoCapitalize="words" autoCorrect={false} />
      </Animated.View>

      <Animated.View style={a(4)}>
        <Text style={styles.label}>BIO <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput style={[styles.input, styles.bioInput]} placeholder="A little something about you..."
          placeholderTextColor="rgba(107,107,138,0.5)" value={bio} onChangeText={setBio}
          multiline maxLength={120} autoCorrect={false} />
        <Text style={styles.charCount}>{bio.length}/120</Text>
      </Animated.View>

      <Animated.View style={a(5)}>
        <TouchableOpacity style={[styles.btnPrimary, !displayName.trim() && styles.btnDisabled]}
          activeOpacity={0.85} onPress={() => displayName.trim() && setStep(2)}>
          <Text style={styles.btnPrimaryText}>Next →</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );

  // ── STEP 2 ──────────────────────────────────────────────────────
  const renderStep2 = () => (
    <>
      <Animated.View style={[styles.stepHeader, a(0)]}>
        <Text style={styles.stepLabel}>STEP 2 OF 2</Text>
        <Text style={styles.stepTitle}>Your personality</Text>
        <Text style={styles.stepSub}>Pick up to 5 tags that describe you</Text>
      </Animated.View>

      <Animated.View style={a(1)}>
        <Text style={styles.label}>VIBE TAGS ({selectedTags.length}/5)</Text>
        <View style={styles.tagsGrid}>
          {EMOJI_TAGS.map(tag => {
            const active   = selectedTags.includes(tag);
            const disabled = !active && selectedTags.length >= 5;
            return (
              <TouchableOpacity key={tag} onPress={() => toggleTag(tag)}
                style={[styles.tagChip, active && styles.tagChipActive, disabled && styles.tagChipDisabled]}
                activeOpacity={0.75}>
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View style={a(2)}>
        <Text style={[styles.label, { marginTop: 20 }]}>YOUR MAIN VIBE</Text>
        {VIBES.map(v => (
          <TouchableOpacity key={v.id} onPress={() => setSelectedVibe(v.id)}
            style={[styles.vibeOption, selectedVibe === v.id && styles.vibeOptionActive]}
            activeOpacity={0.8}>
            <Text style={[styles.vibeOptionText, selectedVibe === v.id && styles.vibeOptionTextActive]}>{v.label}</Text>
            {selectedVibe === v.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </Animated.View>

      <Animated.View style={[{ flexDirection: 'row', gap: 10, marginTop: 24 }, a(3)]}>
        <TouchableOpacity style={styles.btnBack} onPress={() => setStep(1)}>
          <Text style={styles.btnBackText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, { flex: 1 }, (selectedTags.length === 0 || saving) && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={() => selectedTags.length > 0 && setStep(3)}
        >
          <Text style={styles.btnPrimaryText}>Create Profile ✦</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );

  // ── STEP 3: Welcome ─────────────────────────────────────────────
  const renderStep3 = () => (
    <View style={styles.welcomeScreen}>
      <Animated.View style={[{ alignItems: 'center' }, a(0)]}>
        <View style={[styles.avatarRingLarge, activeBorder?.id !== 'none' && {
          borderColor: activeBorder?.borderColor, shadowColor: activeBorder?.shadowColor,
          shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12
        }]}>
          {profileImage
            ? <Image source={{ uri: profileImage }} style={styles.avatarImageLarge} />
            : <View style={[styles.avatarPlaceholder, { width: 120, height: 120, borderRadius: 60 }]}>
                <Text style={{ fontSize: 44 }}>🧑‍🎤</Text>
              </View>
          }
        </View>
      </Animated.View>

      <Animated.View style={[{ alignItems: 'center', marginTop: 20 }, a(1)]}>
        <Text style={styles.welcomeName}>Hey, {displayName.split(' ')[0]}! 👋</Text>
        <Text style={styles.welcomeSub}>Your vibe is live</Text>
        <View style={styles.vibeCodeLarge}>
          <Text style={styles.vibeCodeLargeLabel}>YOUR VIBE CODE</Text>
          <Text style={styles.vibeCodeLargeText}>{userParam?.vibe_code || '...'}</Text>
          <Text style={styles.vibeCodeLargeHint}>Share this with friends to connect</Text>
        </View>
      </Animated.View>

      <Animated.View style={[{ width: '100%', marginTop: 16 }, a(2)]}>
        <View style={styles.summaryCard}>
          {selectedTags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.summaryTag}><Text style={styles.summaryTagText}>{tag}</Text></View>
          ))}
          {selectedTags.length > 3 && (
            <View style={styles.summaryTag}><Text style={styles.summaryTagText}>+{selectedTags.length - 3} more</Text></View>
          )}
        </View>
        {bio ? <Text style={styles.summaryBio}>"{bio}"</Text> : null}
      </Animated.View>

      <Animated.View style={[{ width: '100%', marginTop: 28 }, a(3)]}>
        <TouchableOpacity
          style={[styles.btnPrimary, saving && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={goToHome}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>🚀 Let's Go</Text>
          }
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      {step < 3 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  blobTop: { position: 'absolute', top: -100, left: -80, width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(179,157,219,0.12)' },
  blobBottom: { position: 'absolute', bottom: -80, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,212,255,0.07)' },
  progressBar: { height: 3, backgroundColor: 'rgba(123,94,167,0.1)', marginHorizontal: 32, marginTop: 8, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7B5EA7', borderRadius: 2 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 48, paddingTop: 8 },
  stepHeader: { paddingTop: 16, paddingBottom: 24 },
  stepLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#B39DDB', fontWeight: '600', marginBottom: 6 },
  stepTitle: { fontStyle: 'italic', fontSize: 32, color: '#1A1A2E', fontWeight: '300', letterSpacing: -0.5 },
  stepSub: { fontSize: 14, color: '#6B6B8A', marginTop: 4 },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 104, height: 104, borderRadius: 52 },
  avatarPlaceholder: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#F0EFF8', alignItems: 'center', justifyContent: 'center', gap: 4 },
  avatarEmoji: { fontSize: 28 },
  avatarPlaceholderText: { fontSize: 11, color: '#B39DDB', fontStyle: 'italic' },
  vibeCodeBadge: { marginTop: 10, backgroundColor: 'rgba(123,94,167,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(123,94,167,0.2)' },
  vibeCodeText: { fontSize: 13, color: '#7B5EA7', fontWeight: '600', letterSpacing: 1 },
  borderScroll: { marginBottom: 20 },
  borderOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.15)', marginRight: 8, backgroundColor: '#fff' },
  borderOptionActive: { backgroundColor: 'rgba(123,94,167,0.1)', borderColor: '#7B5EA7' },
  borderOptionText: { fontSize: 13, color: '#1A1A2E' },
  label: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', marginBottom: 6, marginLeft: 4, fontWeight: '500' },
  optional: { textTransform: 'none', fontSize: 10, color: '#B39DDB', letterSpacing: 0 },
  input: { backgroundColor: '#F0EFF8', borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', padding: 14, fontSize: 15, color: '#1A1A2E', fontStyle: 'italic', marginBottom: 16 },
  bioInput: { height: 90, textAlignVertical: 'top', paddingTop: 14, marginBottom: 4 },
  charCount: { fontSize: 11, color: 'rgba(107,107,138,0.5)', alignSelf: 'flex-end', marginBottom: 16 },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F0EFF8', borderWidth: 1.5, borderColor: 'transparent' },
  tagChipActive: { backgroundColor: 'rgba(123,94,167,0.12)', borderColor: '#7B5EA7' },
  tagChipDisabled: { opacity: 0.35 },
  tagText: { fontSize: 13, color: '#6B6B8A' },
  tagTextActive: { color: '#7B5EA7', fontWeight: '500' },
  vibeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.12)', backgroundColor: '#fff', marginBottom: 10 },
  vibeOptionActive: { borderColor: '#7B5EA7', backgroundColor: 'rgba(123,94,167,0.06)' },
  vibeOptionText: { fontSize: 15, color: '#6B6B8A' },
  vibeOptionTextActive: { color: '#1A1A2E', fontWeight: '500' },
  checkmark: { fontSize: 16, color: '#7B5EA7', fontWeight: '700' },
  btnPrimary: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '500', letterSpacing: 0.3 },
  btnDisabled: { backgroundColor: 'rgba(107,107,138,0.2)', shadowOpacity: 0, elevation: 0 },
  btnBack: { paddingHorizontal: 20, borderRadius: 16, paddingVertical: 17, borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.18)', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  btnBackText: { fontSize: 15, color: '#6B6B8A', fontStyle: 'italic' },
  welcomeScreen: { flex: 1, alignItems: 'center', paddingTop: 32 },
  avatarRingLarge: { width: 136, height: 136, borderRadius: 68, borderWidth: 3.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  avatarImageLarge: { width: 128, height: 128, borderRadius: 64 },
  welcomeName: { fontStyle: 'italic', fontSize: 34, color: '#1A1A2E', fontWeight: '300', marginTop: 4 },
  welcomeSub: { fontSize: 14, color: '#6B6B8A', marginTop: 4 },
  vibeCodeLarge: { marginTop: 20, alignItems: 'center', backgroundColor: 'rgba(123,94,167,0.07)', borderRadius: 20, paddingHorizontal: 28, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(123,94,167,0.18)', width: '100%' },
  vibeCodeLargeLabel: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#B39DDB', marginBottom: 4 },
  vibeCodeLargeText: { fontSize: 28, color: '#7B5EA7', fontWeight: '700', letterSpacing: 3 },
  vibeCodeLargeHint: { fontSize: 12, color: '#6B6B8A', marginTop: 4, fontStyle: 'italic' },
  summaryCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  summaryTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(123,94,167,0.1)', borderWidth: 1, borderColor: 'rgba(123,94,167,0.2)' },
  summaryTagText: { fontSize: 13, color: '#7B5EA7' },
  summaryBio: { fontStyle: 'italic', fontSize: 14, color: '#6B6B8A', textAlign: 'center', marginTop: 16, lineHeight: 20 },
});