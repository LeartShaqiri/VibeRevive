import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';

export default function RegisterScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [focused,   setFocused]   = useState(null);
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState('');

  const fadeAnims  = useRef([...Array(6)].map(() => new Animated.Value(0))).current;
  const slideAnims = useRef([...Array(6)].map(() => new Animated.Value(30))).current;

  useEffect(() => {
    fadeAnims.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim,          { toValue: 1, duration: 550, delay: i * 100, useNativeDriver: true }),
        Animated.timing(slideAnims[i], { toValue: 0, duration: 450, delay: i * 100, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const a = (i) => ({ opacity: fadeAnims[i], transform: [{ translateY: slideAnims[i] }] });

  const inputStyle = (field) => [
    styles.input,
    focused === field  && styles.inputFocused,
    errors[field]      && styles.inputError,
  ];

  const validate = () => {
    const e = {};
    if (!firstName.trim())                    e.firstName = 'Required';
    if (!lastName.trim())                     e.lastName  = 'Required';
    if (!email.trim() || !email.includes('@')) e.email    = 'Valid email required';
    if (password.length < 8)                  e.password  = 'Min. 8 characters';
    if (password !== confirm)                 e.confirm   = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await api.register({ firstName, lastName, email, phone, password });
      // ✅ Pass full user object + token to ProfileSetup
      navigation.navigate('ProfileSetup', {
        firstName,
        lastName,
        token: data.token,
        user:  data.user,
      });
    } catch (err) {
      setApiError(err.message || 'Something went wrong. Try again.');
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

          <Animated.View style={a(0)}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.logoArea, a(1)]}>
            <Text style={styles.logoText}>VibeRevive</Text>
            <Text style={styles.tagline}>reignite your people</Text>
            <View style={styles.dot} />
          </Animated.View>

          <Animated.Text style={[styles.formTitle, a(2)]}>Create your vibe</Animated.Text>

          {apiError ? (
            <Animated.View style={[styles.errorBox, a(2)]}>
              <Text style={styles.errorBoxText}>⚠ {apiError}</Text>
            </Animated.View>
          ) : null}

          <Animated.View style={a(3)}>
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>FIRST NAME</Text>
                <TextInput
                  style={inputStyle('firstName')}
                  placeholder="Alex"
                  placeholderTextColor="rgba(107,107,138,0.5)"
                  value={firstName}
                  onChangeText={(v) => { setFirstName(v); setErrors(e => ({ ...e, firstName: null })); }}
                  onFocus={() => setFocused('firstName')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {errors.firstName ? <Text style={styles.errorText}>⚠ {errors.firstName}</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>LAST NAME</Text>
                <TextInput
                  style={inputStyle('lastName')}
                  placeholder="Kim"
                  placeholderTextColor="rgba(107,107,138,0.5)"
                  value={lastName}
                  onChangeText={(v) => { setLastName(v); setErrors(e => ({ ...e, lastName: null })); }}
                  onFocus={() => setFocused('lastName')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {errors.lastName ? <Text style={styles.errorText}>⚠ {errors.lastName}</Text> : null}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={a(4)}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={inputStyle('email')}
              placeholder="your@email.com"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors(e => ({ ...e, email: null })); setApiError(''); }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? <Text style={styles.errorText}>⚠ {errors.email}</Text> : null}

            <Text style={[styles.label, { marginTop: 14 }]}>PHONE <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={inputStyle('phone')}
              placeholder="+1 234 567 890"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={phone}
              onChangeText={setPhone}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { marginTop: 14 }]}>PASSWORD</Text>
            <TextInput
              style={inputStyle('password')}
              placeholder="min. 8 characters"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.password ? <Text style={styles.errorText}>⚠ {errors.password}</Text> : null}

            <Text style={[styles.label, { marginTop: 14 }]}>CONFIRM PASSWORD</Text>
            <TextInput
              style={inputStyle('confirm')}
              placeholder="repeat password"
              placeholderTextColor="rgba(107,107,138,0.5)"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setErrors(e => ({ ...e, confirm: null })); }}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.confirm ? <Text style={styles.errorText}>⚠ {errors.confirm}</Text> : null}
          </Animated.View>

          <Animated.View style={a(5)}>
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              activeOpacity={0.85}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Create account ✦</Text>
              }
            </TouchableOpacity>
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.switchLink}>Sign in</Text>
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
  blobTop: { position: 'absolute', top: -80, right: -100, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(255,105,180,0.07)' },
  blobBottom: { position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(179,157,219,0.11)' },
  scroll: { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 40 },
  backBtn: { marginTop: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: '#6B6B8A', fontStyle: 'italic' },
  logoArea: { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  logoText: { fontStyle: 'italic', fontSize: 36, color: '#1A1A2E', fontWeight: '300', letterSpacing: -1 },
  tagline: { fontStyle: 'italic', fontSize: 14, color: '#6B6B8A', letterSpacing: 0.4, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#B39DDB', marginTop: 14 },
  formTitle: { fontStyle: 'italic', fontSize: 28, color: '#1A1A2E', textAlign: 'center', marginBottom: 16, fontWeight: '300' },
  errorBox: { backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)' },
  errorBoxText: { fontSize: 13, color: '#FF6B6B', textAlign: 'center' },
  label: { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6B8A', marginBottom: 6, marginLeft: 4, fontWeight: '500' },
  optional: { textTransform: 'none', fontSize: 10, color: '#B39DDB', letterSpacing: 0 },
  input: { backgroundColor: '#F0EFF8', borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', padding: 14, fontSize: 15, color: '#1A1A2E', marginBottom: 4 },
  inputFocused: { borderColor: '#B39DDB', backgroundColor: '#fff', shadowColor: '#7B5EA7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  inputError: { borderColor: '#FF6B6B', backgroundColor: '#fff' },
  errorText: { fontSize: 11, color: '#FF6B6B', marginTop: 2, marginBottom: 8, marginLeft: 4, fontStyle: 'italic' },
  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btnPrimary: { backgroundColor: '#1A1A2E', borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5, marginBottom: 14, marginTop: 20 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '500', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
  switchRow: { flexDirection: 'row', justifyContent: 'center' },
  switchText: { fontSize: 14, color: '#6B6B8A' },
  switchLink: { fontSize: 14, color: '#7B5EA7', fontWeight: '500', borderBottomWidth: 1, borderBottomColor: 'rgba(123,94,167,0.35)' },
});