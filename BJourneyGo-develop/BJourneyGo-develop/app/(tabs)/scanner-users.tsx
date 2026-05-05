import { useAuth } from '@/contexts/auth-context'
import { createScannerOperator } from '@/lib/api'
import { Redirect } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

function normalizeRole(role?: string) {
  return String(role || '').toUpperCase()
}

export default function ScannerUsersScreen() {
  const { user } = useAuth()
  const role = normalizeRole(user?.role)
  const canManage = useMemo(() => role === 'ADMIN', [role])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyPhone, setAgencyPhone] = useState('')
  const [agencyAddress, setAgencyAddress] = useState('')
  const [loading, setLoading] = useState(false)

  async function onCreate() {
    if (!canManage) return
    if (!name.trim() || !email.trim() || !password.trim() || !agencyName.trim()) {
      Alert.alert('Campos requeridos', 'Nombre, email, contrasena y nombre de agencia son obligatorios.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Contrasena invalida', 'La contrasena debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      await createScannerOperator({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        agencyName: agencyName.trim(),
        agencyPhone: agencyPhone.trim() || undefined,
        agencyAddress: agencyAddress.trim() || undefined,
      })
      Alert.alert('Usuario creado', 'Operador de escaneo QR creado correctamente.')
      setName('')
      setEmail('')
      setPassword('')
      setAgencyName('')
      setAgencyPhone('')
      setAgencyAddress('')
    } catch (e: any) {
      Alert.alert('No se pudo crear', e?.message || 'Error creando operador escaner')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return <Redirect href="/login" />
  if (!canManage) return <Redirect href="/(tabs)/home" />

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Text style={styles.headerText}>OPERADORES QR</Text>
      </View>

      <View style={styles.formWrap}>
        <Text style={styles.formTitle}>Nuevo operador de escaneo</Text>

        <TextInput style={styles.input} placeholder="Nombre completo" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Contrasena" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="Nombre de agencia" value={agencyName} onChangeText={setAgencyName} />
        <TextInput style={styles.input} placeholder="Telefono de agencia (opcional)" value={agencyPhone} onChangeText={setAgencyPhone} />
        <TextInput style={styles.input} placeholder="Direccion de agencia (opcional)" value={agencyAddress} onChangeText={setAgencyAddress} />

        <TouchableOpacity style={[styles.primaryBtn, loading && styles.disabledBtn]} onPress={onCreate} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? 'Creando...' : 'Crear Operador Escaner'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F4F4' },
  topHeader: {
    backgroundColor: '#224F9A',
    height: 96,
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 36 : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { fontSize: 22, color: '#fff', fontWeight: '800' },
  formWrap: {
    margin: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 12,
    gap: 9,
  },
  formTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: '#F0833F',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  denyTitle: { fontSize: 20, fontWeight: '800', color: '#991B1B' },
  denyText: { marginTop: 8, color: '#4B5563', textAlign: 'center' },
})
