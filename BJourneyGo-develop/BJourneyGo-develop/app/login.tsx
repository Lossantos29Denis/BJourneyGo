import { ThemedButton } from '@/components/themed-button';
import { ThemedInput } from '@/components/themed-input';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth-context';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function LoginScreen() {
  const [identity, setIdentity] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    setIdentityError('');
    setPasswordError('');

    let hasError = false;
    if (!identity) {
      setIdentityError('Correo o usuario requerido');
      hasError = true;
    }
    if (!password) {
      setPasswordError('La contraseña es requerida');
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);
    try {
      await login(identity, password);
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.logoTextContainer}>
          <Text style={styles.logoTextBJourney}>BJOURNEY</Text>
          <Text style={styles.logoTextGo}>GO</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.mainTitle}>Iniciar sesión</ThemedText>

          <View style={styles.form}>
            <ThemedInput
              label="Correo o usuario"
              placeholder="correo o usuario"
              value={identity}
              onChangeText={(text) => { setIdentity(text); setIdentityError(''); }}
              error={identityError}
              autoCapitalize="none"
              icon="envelope"
              lightColor="#ffffff"
              darkColor="#ffffff"
              textColorLight="#000000"
              textColorDark="#000000"
              placeholderTextColor="#9CA3AF"
            />

            <ThemedInput
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={(text) => { setPassword(text); setPasswordError(''); }}
              error={passwordError}
              isPassword
              autoComplete="password"
              icon="lock"
              lightColor="#ffffff"
              darkColor="#ffffff"
              textColorLight="#000000"
              textColorDark="#000000"
              placeholderTextColor="#9CA3AF"
            />

            <ThemedButton title="Iniciar Sesión" onPress={handleLogin} isLoading={isLoading} style={[styles.registerButton, { backgroundColor: '#FF6B35' }]} variant="primary" />

            <View style={styles.bottomTextContainer}>
              <Text style={styles.bottomTextGray}>¿No tienes cuenta? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.bottomTextBlue}>Regístrate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  mainTitle: { fontSize: 32, fontWeight: 'bold', color: '#000000', textAlign: 'center', marginBottom: 24, fontFamily: 'System' },
  form: { width: '100%' },
  registerButton: { marginTop: 16, marginBottom: 8, borderRadius: 12 },
  bottomTextContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  bottomTextGray: { fontSize: 14, color: '#6B7280', fontFamily: 'System' },
  bottomTextBlue: { fontSize: 14, color: '#1C3F7A', fontWeight: '500', fontFamily: 'System' },
});
