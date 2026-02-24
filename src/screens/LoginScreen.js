import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, TextInput,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TypingText from '../components/TypingText';
import { api } from '../api';

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
        Animated.timing(anim,           { toValue: 1, duration: 550, delay: i * 130, useNativeDriver: true }),
        Animated.timing(slideAnims[i],  { toValue: 0, duration: 450, delay: i * 130, useNativeDriver: true }),
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
      // Navigate to ProfileSetup if first time, otherwise Home
      navigation.navigate('Home', {
        displayName: `${data.user.first_name} ${data.user.last_name}`.trim(),
        vibeCode:    data.user.vibe_code,
        token:       data.token,
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

          {/* Logo / typing animation */}
          <Animated.View style={[styles.logoArea, a(0)]}>
            <TypingText size={52} />
            <Text style={styles.tagline}>reignite your people</Text>
            <View style={styles.dot} />
          </Animated.View>

          {/* Welcome */}
          <Animated.Text style={[styles.formTitle, a(1)]}>Welcome back</Animated.Text>

          {/* Error */}
          {error ? (
            <Animated.View style={[styles.errorBox, a(1)]}>
              <Text style={styles.errorBoxText}>⚠ {error}</Text>
            </Animated.View>
          ) : null}

          {/* Email */}
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

          {/* Password */}
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
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Sign in button */}
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

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Text style={styles.socialBtnText}>🌐  Continue with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Text style={styles.socialBtnText}>🍎  Continue with Apple</Text>
            </TouchableOpacity>

            {/* Switch to register */}
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
  logoArea: { alignItems: 'center', paddingTop: 48, paddingBottom: 24 },
  tagline: { fontStyle: 'italic', fontSize: 14, color: '#6B6B8A', letterSpacing: 0.4, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#B39DDB', marginTop: 16 },
  formTitle: { fontStyle: 'italic', fontSize: 30, color: '#1A1A2E', textAlign: 'center', marginBottom: 24, fontWeight: '300' },
  errorBox: { backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)' },
  errorBoxText: { fontSize: 13, color: '#FF6B6B', textAlign: 'center' },
  label: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', marginBottom: 6, marginLeft: 4, fontWeight: '500' },
  input: { backgroundColor: '#F0EFF8', borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', padding: 14, fontSize: 15, color: '#1A1A2E', marginBottom: 16 },
  inputFocused: { borderColor: '#B39DDB', backgroundColor: '#fff', shadowColor: '#7B5EA7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 24 },
  forgotText: { fontSize: 13, color: '#7B5EA7', fontStyle: 'italic' },
  btnPrimary: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5, marginBottom: 24 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '500', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,107,138,0.15)' },
  dividerText: { fontSize: 12, color: '#6B6B8A' },
  socialBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(107,107,138,0.18)', backgroundColor: '#fff', marginBottom: 10 },
  socialBtnText: { fontSize: 15, color: '#1A1A2E', fontWeight: '400' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText: { fontSize: 14, color: '#6B6B8A' },
  switchLink: { fontSize: 14, color: '#7B5EA7', fontWeight: '500', borderBottomWidth: 1, borderBottomColor: 'rgba(123,94,167,0.35)' },
});