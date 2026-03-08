import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, TextInput,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

// Typing animation — cycles through phrases every 2.5s
const PHRASES = [
  'VibeRevive',
  'reignite your people',
  'reconnect. recharge.',
  'your crew awaits',
  'VibeRevive',
];

function TypingAnimation() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed,   setDisplayed]   = useState('');
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [cursor,      setCursor]      = useState(true);

  // Cursor blink
  useEffect(() => {
    const blink = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(blink);
  }, []);

  // Typing logic
  useEffect(() => {
    const current = PHRASES[phraseIndex];
    let timeout;

    if (!isDeleting && displayed.length < current.length) {
      // Still typing
      timeout = setTimeout(() => {
        setDisplayed(current.slice(0, displayed.length + 1));
      }, 80);
    } else if (!isDeleting && displayed.length === current.length) {
      // Pause at full word, then start deleting
      timeout = setTimeout(() => setIsDeleting(true), 1800);
    } else if (isDeleting && displayed.length > 0) {
      // Deleting
      timeout = setTimeout(() => {
        setDisplayed(current.slice(0, displayed.length - 1));
      }, 45);
    } else if (isDeleting && displayed.length === 0) {
      // Move to next phrase
      setIsDeleting(false);
      setPhraseIndex(i => (i + 1) % PHRASES.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, phraseIndex]);

  const isMainTitle = PHRASES[phraseIndex] === 'VibeRevive';

  return (
    <View style={styles.typingWrap}>
      <Text style={[styles.typingText, !isMainTitle && styles.typingTextSub]}>
        {displayed}
        <Text style={[styles.cursor, { opacity: cursor ? 1 : 0 }]}>|</Text>
      </Text>
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [focused,  setFocused]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const fadeAnims  = useRef([...Array(5)].map(() => new Animated.Value(0))).current;
  const slideAnims = useRef([...Array(5)].map(() => new Animated.Value(30))).current;

  useEffect(() => {
    fadeAnims.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim,          { toValue: 1, duration: 600, delay: i * 150, useNativeDriver: true }),
        Animated.timing(slideAnims[i], { toValue: 0, duration: 500, delay: i * 150, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const a = (i) => ({ opacity: fadeAnims[i], transform: [{ translateY: slideAnims[i] }] });

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.login({ email: email.trim(), password });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home', params: { token: data.token, user: data.user } }],
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Typing animation logo area ── */}
          <Animated.View style={[styles.logoArea, a(0)]}>
            <TypingAnimation />
            <View style={styles.dot} />
          </Animated.View>

          <Animated.Text style={[styles.formTitle, a(1)]}>Welcome back</Animated.Text>

          {error ? (
            <Animated.View style={[styles.errorBox, a(1)]}>
              <Text style={styles.errorBoxText}>⚠ {error}</Text>
            </Animated.View>
          ) : null}

          <Animated.View style={a(2)}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={[styles.input, focused === 'email' && styles.inputFocused]}
              placeholder="your@email.com"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Animated.View>

          <Animated.View style={a(3)}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={[styles.input, focused === 'password' && styles.inputFocused]}
              placeholder="Enter your password"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Animated.View>

          <Animated.View style={a(4)}>
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Sign in</Text>
              }
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>New here? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.switchLink}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  blobTop: { position: 'absolute', top: -100, left: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(179,157,219,0.13)' },
  blobBottom: { position: 'absolute', bottom: -80, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,212,255,0.07)' },
  scroll: { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 40 },

  logoArea: { alignItems: 'center', paddingTop: 80, paddingBottom: 32 },
  typingWrap: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  typingText: {
    fontStyle: 'italic', fontSize: 44, color: '#1A1A2E',
    fontWeight: '300', letterSpacing: -1, textAlign: 'center',
  },
  typingTextSub: {
    fontSize: 22, color: '#7B5EA7', fontWeight: '300',
    letterSpacing: 0.2,
  },
  cursor: { color: '#B39DDB', fontWeight: '200' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#B39DDB', marginTop: 18 },

  formTitle: { fontStyle: 'italic', fontSize: 30, color: '#1A1A2E', textAlign: 'center', marginBottom: 24, fontWeight: '300' },
  errorBox: { backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)' },
  errorBoxText: { fontSize: 13, color: '#FF6B6B', textAlign: 'center' },
  label: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', marginBottom: 6, marginLeft: 4, fontWeight: '500' },
  input: { backgroundColor: '#F0EFF8', borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', padding: 14, fontSize: 15, color: '#1A1A2E', marginBottom: 16 },
  inputFocused: { borderColor: '#B39DDB', backgroundColor: '#fff', shadowColor: '#7B5EA7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  btnPrimary: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5, marginBottom: 24, marginTop: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '500', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
  switchRow: { flexDirection: 'row', justifyContent: 'center' },
  switchText: { fontSize: 14, color: '#6B6B8A' },
  switchLink: { fontSize: 14, color: '#7B5EA7', fontWeight: '500', borderBottomWidth: 1, borderBottomColor: 'rgba(123,94,167,0.35)' },
});