import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, Modal, ActivityIndicator, Linking } from "react-native";
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { login as apiLogin, verifyStatus, resendVerificationEmailPublic } from '@/lib/api'

export default function Index() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    BlackHans: require("@/assets/fonts/BlackHanSans-Regular.ttf"),
  });

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verifyVisible, setVerifyVisible] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [pendingPassword, setPendingPassword] = useState('')
  const verifyTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const { register: registerUser } = useAuth()

  useEffect(() => {
    if (!verifyVisible) {
      if (verifyTimer.current) clearInterval(verifyTimer.current)
      verifyTimer.current = null
      return
    }
    verifyTimer.current = setInterval(async () => {
      try {
        if (!verificationId) return
        const resp = await verifyStatus(verificationId)
        if (resp?.verified) {
          const loginResp = await apiLogin(verifyEmail, pendingPassword)
          if (loginResp?.token) {
            setVerifyVisible(false)
            setVerificationMessage('')
            router.push('/(tabs)/home')
          }
        }
      } catch (e) {}
    }, 4000)
    return () => {
      if (verifyTimer.current) clearInterval(verifyTimer.current)
      verifyTimer.current = null
    }
  }, [verifyVisible])

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>

      <View style={styles.topHalf}>
        <Image source={require('@/assets/images/logo.png')} style={styles.imageIcon} />

        <Text style={styles.brandText}>
          BJOURNEY
          <Text style={styles.goText}>GO</Text>
        </Text>
      </View>

      <View style={styles.bottomHalf}>  
        <Text style={styles.logintext}>Crea tu cuenta</Text>

        <View style={styles.whiteBox}>
          <Image source={require('@/assets/images/correo.png')} style={{ width: 22, height: 20 }} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Correo electrónico" placeholderTextColor={"#CCCCCC"} style={styles.input}></TextInput>
        </View>

        <View style={styles.whiteBox}>
          <Image source={require('@/assets/images/lock.png')} style={{ width: 20, height: 22 }} />
          <TextInput value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor={"#CCCCCC"} secureTextEntry={true} style={styles.input}></TextInput>
        </View>

        <TouchableOpacity style={[styles.ButtonStyle, {backgroundColor: '#F0833F'}]} activeOpacity={0.7} onPress={async () => {
          try {
            const resp = await registerUser(email, email, password)
            setVerifyEmail(email)
            setVerificationId(resp?.verificationId || '')
            setPendingPassword(password)
            setVerificationMessage(resp?.mailDisabled ? 'Temporalmente no disponible.' : 'Esperando confirmacion...')
            setVerifyVisible(true)
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Register failed')
          }
        }}>
          <Text style={styles.ButtonText}>Registrarse</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', marginTop: 20 }}>
          <Text>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={{ color: '#FF8C00', fontWeight: 'bold' }}>Inicia Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={verifyVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Revisa tu correo</Text>
            <Text style={styles.modalText}>Te enviamos un enlace de verificacion a:</Text>
            <Text style={styles.modalEmail}>{verifyEmail}</Text>
            <Text style={styles.modalText}>Abre tu Gmail, haz clic en el enlace y volveremos automaticamente.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalPrimary]} onPress={async () => {
                try {
                  await Linking.openURL('https://mail.google.com')
                } catch (e) {
                  try { await Linking.openURL('mailto:') } catch (err) { Alert.alert('Aviso', 'No se pudo abrir Gmail') }
                }
              }}>
                <Text style={styles.modalButtonText}>Abrir Gmail</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalGhost]} onPress={async () => {
                try {
                  setVerificationMessage('Reenviando correo...')
                  if (!verifyEmail || !verificationId) {
                    setVerificationMessage('No se pudo reenviar.')
                    return
                  }
                  const resp = await resendVerificationEmailPublic(verifyEmail, verificationId)
                  if (resp?.alreadyVerified) {
                    setVerificationMessage('Tu cuenta ya esta verificada.')
                    return
                  }
                  if (resp?.verificationId) setVerificationId(resp.verificationId)
                  setVerificationMessage('Correo reenviado. Revisa tu bandeja de entrada.')
                } catch (e: any) {
                  if (e?.code === 'MAIL_DISABLED') {
                    setVerificationMessage('Temporalmente no disponible.')
                    return
                  }
                  if (e?.code === 'RATE_LIMIT') {
                    setVerificationMessage('Espera un momento antes de reenviar.')
                    return
                  }
                  setVerificationMessage('No se pudo reenviar. Intenta mas tarde.')
                }
              }}>
                <Text style={styles.modalButtonText}>Reenviar correo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalGhost]} onPress={async () => {
                try {
                  setVerificationMessage('Comprobando verificacion...')
                  if (!verificationId) {
                    setVerificationMessage('No se encontro el ID de verificacion.')
                    return
                  }
                  const resp = await verifyStatus(verificationId)
                  if (resp?.verified) {
                    const loginResp = await apiLogin(verifyEmail, pendingPassword)
                    if (loginResp?.token) {
                      setVerifyVisible(false)
                      setVerificationMessage('')
                      router.push('/(tabs)/home')
                    } else {
                      setVerificationMessage('Cuenta verificada. Inicia sesion.')
                    }
                  } else {
                    setVerificationMessage('Aun no esta verificado. Esperando...')
                  }
                } catch (e) {
                  setVerificationMessage('No se pudo comprobar. Reintentando...')
                }
              }}>
                <Text style={styles.modalButtonText}>Ya he verificado</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalStatusRow}>
              <ActivityIndicator size="small" color="#F0833F" />
              <Text style={styles.modalStatusText}>{verificationMessage}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHalf: {
    flex: 0.9,
    backgroundColor: "#224F9A",
    justifyContent: "center",
    alignItems: "center"
  },
  bottomHalf: {
    flex: 1.4,
    backgroundColor: "#E6E6E6",
    alignItems: "center",
  },
  imageIcon: { 
    width: 152, 
    height: 147,
    marginEnd: 5,
    marginBottom: 35, 
  },
  brandText: {
    fontFamily: "BlackHans",
    fontSize: 36,
    color: "white",
    marginBottom: 20,
  },
  goText: {
    color: "#FF8C00"
  },
  logintext: {
    fontSize: 40,
    marginTop: 30,
    fontFamily: "BlackHans",
  },
  whiteBox: { 
    width: '70%',
    height: 60, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    paddingHorizontal: 15, 
    alignSelf: 'center', 
    marginTop: 40, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3, // sombra en Android 

    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBox: { 
    fontSize: 16, 
    color: '#CCCCCC',
    marginRight: 110,
  },
  input: { 
    flex: 1, 
    marginLeft: 10, 
    fontSize: 16, 
    color: "#000", 
  },
  ButtonStyle: { 
    marginTop: 50, 
    width: '70%',
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
  },
  ButtonText: {
    color: 'white', 
    fontSize: 18, 
    fontWeight: '600', 
    textAlign: 'center', 
    lineHeight: 50,
    marginTop: 5,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,8,8,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#224F9A', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 6 },
  modalEmail: { fontSize: 14, color: '#111827', fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  modalButtons: { width: '100%', gap: 10, marginTop: 8 },
  modalButton: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalPrimary: { backgroundColor: '#F0833F' },
  modalGhost: { backgroundColor: '#E5E7EB' },
  modalButtonText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  modalStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  modalStatusText: { fontSize: 12, color: '#6B7280' },
});
