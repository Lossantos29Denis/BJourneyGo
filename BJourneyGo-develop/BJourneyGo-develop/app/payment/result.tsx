import { confirmStripePayment } from '@/lib/api'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function PaymentResultScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string; session_id?: string }>()
  const status = String(params.status || '').toLowerCase()
  const sessionId = String(params.session_id || '').trim()
  const [loading, setLoading] = React.useState(true)
  const [title, setTitle] = React.useState('')
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    let mounted = true

    async function run() {
      if (status === 'success' && sessionId) {
        try {
          const result = await confirmStripePayment(sessionId)
          if (!mounted) return
          setTitle('Pago confirmado')
          setMessage(result?.referenceCode
            ? `Tu compra se completó correctamente. Referencia: ${result.referenceCode}.`
            : 'Tu compra se completó correctamente.')
        } catch (error: any) {
          if (!mounted) return
          setTitle('Compra recibida')
          setMessage(error?.message || 'No se pudo confirmar automáticamente, pero el pago puede haberse procesado.')
        } finally {
          if (mounted) setLoading(false)
        }
        return
      }

      if (status === 'cancelled') {
        if (!mounted) return
        setTitle('Compra cancelada')
        setMessage('No se ha realizado ningún cargo. Puedes intentarlo de nuevo cuando quieras.')
        setLoading(false)
        return
      }

      if (!mounted) return
      setTitle('Retorno de pago')
      setMessage('No se recibió un estado válido del pago. Volveremos al inicio para que puedas revisar la compra.')
      setLoading(false)
    }

    void run()

    return () => {
      mounted = false
    }
  }, [sessionId, status])

  React.useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      router.replace('/(tabs)/home')
    }, 2200)
    return () => clearTimeout(timer)
  }, [loading, router])

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#F07820" />
            <Text style={styles.title}>Procesando pago</Text>
            <Text style={styles.text}>Estamos verificando tu compra y devolviéndote a la app.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{message}</Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/home')}>
              <Text style={styles.buttonText}>Ir al inicio</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    gap: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#F07820',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
})