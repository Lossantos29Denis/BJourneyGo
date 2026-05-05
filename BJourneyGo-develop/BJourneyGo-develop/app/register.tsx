import { ThemedButton } from '@/components/themed-button';
import { ThemedInput } from '@/components/themed-input';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth-context';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { verifyStatus, resendVerificationEmailPublic } from '@/lib/api';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const verifyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { register, login } = useAuth();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    setUsernameError('');
    setEmailError('');
    setPasswordError('');

    let hasError = false;

    if (!username) { setUsernameError('El nombre de usuario es requerido'); hasError = true; }
    else if (username.length < 2) { setUsernameError('El nombre de usuario debe tener al menos 2 caracteres'); hasError = true; }

    if (!email) { setEmailError('El correo electrónico es requerido'); hasError = true; } else if (!validateEmail(email)) { setEmailError('Correo electrónico inválido'); hasError = true; }

    if (!password) { setPasswordError('La contraseña es requerida'); hasError = true; } else if (password.length < 6) { setPasswordError('La contraseña debe tener al menos 6 caracteres'); hasError = true; }

    if (hasError) return;

    setIsLoading(true);
    try {
      const resp = await register(username, email, password);
      setVerifyEmail(email);
      setVerificationId(resp?.verificationId || '');
      setPendingPassword(password);
      setVerificationMessage(resp?.mailDisabled ? 'Temporalmente no disponible.' : 'Esperando confirmacion...');
      setVerifyVisible(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const openGmail = async () => {
    try {
      await Linking.openURL('https://mail.google.com');
    } catch (e) {
      try {
        await Linking.openURL('mailto:');
      } catch (err) {
        Alert.alert('Aviso', 'No se pudo abrir Gmail');
      }
    }
  };

  const checkVerification = async () => {
    try {
      setVerificationMessage('Comprobando verificacion...');
      if (!verificationId) {
        setVerificationMessage('No se encontro el ID de verificacion.');
        return;
      }
      const resp = await verifyStatus(verificationId);
      if (resp?.verified) {
        await login(verifyEmail, pendingPassword);
        setVerifyVisible(false);
        setVerificationMessage('');
        router.replace('/(tabs)/home');
        return;
      } else {
        setVerificationMessage('Aun no esta verificado. Esperando...');
      }
    } catch (e) {
      setVerificationMessage('No se pudo comprobar. Reintentando...');
    }
  };

  const resendVerification = async () => {
    try {
      setVerificationMessage('Reenviando correo...');
      if (!verifyEmail || !verificationId) {
        setVerificationMessage('No se pudo reenviar.');
        return;
      }
      const resp = await resendVerificationEmailPublic(verifyEmail, verificationId);
      if (resp?.alreadyVerified) {
        setVerificationMessage('Tu cuenta ya esta verificada.');
        return;
      }
      if (resp?.verificationId) setVerificationId(resp.verificationId);
      setVerificationMessage('Correo reenviado. Revisa tu bandeja de entrada.');
    } catch (e: any) {
      if (e?.code === 'MAIL_DISABLED') {
        setVerificationMessage('Temporalmente no disponible.');
        return;
      }
      if (e?.code === 'RATE_LIMIT') {
        setVerificationMessage('Espera un momento antes de reenviar.');
        return;
      }
      setVerificationMessage('No se pudo reenviar. Intenta mas tarde.');
    }
  };

  useEffect(() => {
    if (!verifyVisible) {
      if (verifyTimer.current) clearInterval(verifyTimer.current);
      verifyTimer.current = null;
      return;
    }
    verifyTimer.current = setInterval(checkVerification, 4000);
    checkVerification();
    return () => {
      if (verifyTimer.current) clearInterval(verifyTimer.current);
      verifyTimer.current = null;
    };
  }, [verifyVisible]);

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.logoTextContainer}><Text style={styles.logoTextBJourney}>BJOURNEY</Text><Text style={styles.logoTextGo}>GO</Text></View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.mainTitle}>Crea tu cuenta</ThemedText>

          <View style={styles.form}>
            <ThemedInput label="Correo electrónico" placeholder="tu@email.com" value={email} onChangeText={(text) => { setEmail(text); setEmailError(''); }} error={emailError} keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="envelope" lightColor="#ffffff" darkColor="#ffffff" textColorLight="#000000" textColorDark="#000000" placeholderTextColor="#9CA3AF" />

            <ThemedInput label="Nombre de usuario" placeholder="tu_usuario" value={username} onChangeText={(text) => { setUsername(text); setUsernameError(''); }} error={usernameError} autoCapitalize="none" autoComplete="username" icon="person" lightColor="#ffffff" darkColor="#ffffff" textColorLight="#000000" textColorDark="#000000" placeholderTextColor="#9CA3AF" />

            <ThemedInput label="Contraseña" placeholder="••••••••" value={password} onChangeText={(text) => { setPassword(text); setPasswordError(''); }} error={passwordError} isPassword autoComplete="password" icon="lock" lightColor="#ffffff" darkColor="#ffffff" textColorLight="#000000" textColorDark="#000000" placeholderTextColor="#9CA3AF" />

            <ThemedButton title="Registrarse" onPress={handleRegister} isLoading={isLoading} style={[styles.registerButton, { backgroundColor: '#FF6B35' }]} variant="primary" />

            <View style={styles.bottomTextContainer}><Text style={styles.bottomTextGray}>¿Ya tienes cuenta? </Text><TouchableOpacity onPress={() => router.back()}><Text style={styles.bottomTextBlue}>Inicia sesión</Text></TouchableOpacity></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={verifyVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Revisa tu correo</Text>
            <Text style={styles.modalText}>Te enviamos un enlace de verificacion a:</Text>
            <Text style={styles.modalEmail}>{verifyEmail}</Text>
            <Text style={styles.modalText}>Abre tu Gmail, haz clic en el enlace y volveremos automaticamente.</Text>

            <View style={styles.modalButtons}>
              <ThemedButton title="Abrir Gmail" onPress={openGmail} variant="primary" style={styles.modalButtonPrimary} />
              <ThemedButton title="Reenviar correo" onPress={resendVerification} variant="secondary" style={styles.modalButtonGhost} />
              <ThemedButton title="Ya he verificado" onPress={checkVerification} variant="secondary" style={styles.modalButtonGhost} />
            </View>

            <View style={styles.modalStatusRow}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.modalStatusText}>{verificationMessage}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F4' },
  topSection: { backgroundColor: '#1C3F7A', height: 250, justifyContent: 'center', alignItems: 'center', paddingTop: 40, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 4 } }) },
  logo: { width: 80, height: 80, marginBottom: 16 },
  logoTextContainer: { flexDirection: 'row', alignItems: 'baseline' },
  logoTextBJourney: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', fontFamily: 'System' },
  logoTextGo: { fontSize: 28, fontWeight: 'bold', color: '#FF6B35', fontFamily: 'System' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  mainTitle: { fontSize: 32, fontWeight: 'bold', color: '#000000', textAlign: 'center', marginBottom: 32, fontFamily: 'System' },
  form: { width: '100%' },
  registerButton: { marginTop: 24, marginBottom: 32, borderRadius: 12 },
  bottomTextContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  bottomTextGray: { fontSize: 14, color: '#6B7280', fontFamily: 'System' },
  bottomTextBlue: { fontSize: 14, color: '#1C3F7A', fontWeight: '500', fontFamily: 'System' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,8,8,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1C3F7A', marginBottom: 8, textAlign: 'center', fontFamily: 'System' },
  modalText: { fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 6, fontFamily: 'System' },
  modalEmail: { fontSize: 14, color: '#111827', fontWeight: '700', marginBottom: 12, textAlign: 'center', fontFamily: 'System' },
  modalButtons: { width: '100%', gap: 12, marginTop: 8 },
  modalButtonPrimary: { borderRadius: 10 },
  modalButtonGhost: { borderRadius: 10, backgroundColor: '#E5E7EB' },
  modalStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  modalStatusText: { fontSize: 12, color: '#6B7280', fontFamily: 'System' },
});
