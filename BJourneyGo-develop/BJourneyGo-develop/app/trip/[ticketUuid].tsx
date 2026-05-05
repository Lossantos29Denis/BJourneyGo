import React from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { cancelTicket, changeTicketTrip, getMyOrders, getTicketAlternatives } from '@/lib/api'

type TicketStatus = 'ACTIVE' | 'USED' | 'REFUNDED' | 'CANCELLED' | string

type MyTicket = {
  id?: number
  uuid?: string
  status?: TicketStatus | null
  price?: number | null
  issuedAt?: string | null
  verifiedAt?: string | null
  passengerName?: string | null
  passengerIdentification?: string | null
  qrToken?: string | null
  departureAt?: string | null
  arrivalAt?: string | null
  origin?: string | null
  destination?: string | null
  routeCode?: string | null
  agencyName?: string | null
}

type MyOrder = {
  id?: number
  referenceCode?: string | null
  status?: string | null
  tickets?: MyTicket[]
}

type AlternativeTrip = {
  id: number
  departureAt?: string | null
  arrivalAt?: string | null
  status?: string | null
  capacity?: number
  seatsSold?: number
  basePrice?: number
  routeCode?: string | null
  origin?: string | null
  destination?: string | null
}

function parseLocalDateTime(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return new Date(NaN)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || '0'))
  }
  return new Date(raw)
}

function formatDate(value?: string | null) {
  const d = parseLocalDateTime(value)
  if (Number.isNaN(d.getTime())) return 'Fecha pendiente'
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapStatusLabel(status?: string | null) {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE') return 'Activo'
  if (s === 'USED') return 'Completado'
  if (s === 'CANCELLED') return 'Cancelado'
  if (s === 'REFUNDED') return 'Reembolsado'
  return s || 'Sin estado'
}

export default function TicketDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ ticketUuid?: string }>()
  const ticketUuid = String(params.ticketUuid || '').trim()

  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [ticket, setTicket] = React.useState<MyTicket | null>(null)
  const [order, setOrder] = React.useState<MyOrder | null>(null)
  const [alternatives, setAlternatives] = React.useState<AlternativeTrip[]>([])
  const [loadingAlternatives, setLoadingAlternatives] = React.useState(false)

  const isActiveTicket = String(ticket?.status || '').toUpperCase() === 'ACTIVE'
  const qrImageUri = ticket?.qrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(String(ticket.qrToken))}`
    : ''

  const loadTicket = React.useCallback(async (isRefresh = false) => {
    if (!ticketUuid) {
      setLoading(false)
      return
    }
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const payload = await getMyOrders()
      const orders: MyOrder[] = Array.isArray(payload?.orders) ? payload.orders : []
      let foundOrder: MyOrder | null = null
      let foundTicket: MyTicket | null = null

      for (const o of orders) {
        const tickets = Array.isArray(o?.tickets) ? o.tickets : []
        const t = tickets.find((it) => String(it?.uuid || '') === ticketUuid)
        if (t) {
          foundOrder = o
          foundTicket = t
          break
        }
      }

      setOrder(foundOrder)
      setTicket(foundTicket)
      if (!foundTicket) {
        setAlternatives([])
      }
    } catch (e: any) {
      Alert.alert('Billete', e?.message || 'No se pudo cargar el detalle del billete.')
      setOrder(null)
      setTicket(null)
      setAlternatives([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [ticketUuid])

  const loadAlternatives = React.useCallback(async () => {
    if (!ticketUuid) return
    setLoadingAlternatives(true)
    try {
      const payload = await getTicketAlternatives(ticketUuid, 14)
      const list = Array.isArray(payload?.alternatives) ? payload.alternatives : []
      setAlternatives(list)
      if (list.length === 0) {
        Alert.alert('Cambiar horario', 'No hay viajes alternativos disponibles para esta ruta en los próximos días.')
      }
    } catch (e: any) {
      Alert.alert('Cambiar horario', e?.message || 'No se pudieron cargar las alternativas.')
    } finally {
      setLoadingAlternatives(false)
    }
  }, [ticketUuid])

  React.useEffect(() => {
    loadTicket(false)
  }, [loadTicket])

  const onChangeToAlternative = React.useCallback((newTripId: number) => {
    if (!ticketUuid || !newTripId || busy) return
    Alert.alert(
      'Confirmar cambio',
      'Se cambiará este billete al nuevo horario seleccionado. ¿Deseas continuar?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cambiar',
          style: 'default',
          onPress: async () => {
            try {
              setBusy(true)
              await changeTicketTrip(ticketUuid, newTripId)
              await loadTicket(false)
              await loadAlternatives()
              Alert.alert('Billete actualizado', 'Tu billete fue movido correctamente al nuevo viaje.')
            } catch (e: any) {
              Alert.alert('Cambio de billete', e?.message || 'No se pudo cambiar el billete.')
            } finally {
              setBusy(false)
            }
          }
        },
      ]
    )
  }, [busy, loadAlternatives, loadTicket, ticketUuid])

  const onCancelTicket = React.useCallback(() => {
    if (!ticketUuid || busy) return
    Alert.alert(
      'Cancelar billete',
      'Tu billete se marcará como cancelado. El reembolso automático no está aplicado en esta versión. ¿Continuar?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true)
              await cancelTicket(ticketUuid)
              await loadTicket(false)
              setAlternatives([])
              Alert.alert('Billete cancelado', 'La cancelación se guardó correctamente.')
            } catch (e: any) {
              Alert.alert('Cancelar billete', e?.message || 'No se pudo cancelar el billete.')
            } finally {
              setBusy(false)
            }
          }
        },
      ]
    )
  }, [busy, loadTicket, ticketUuid])

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredBlock}>
          <Text style={styles.helper}>Cargando detalle del billete...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!ticketUuid || !ticket) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredBlock}>
          <Text style={styles.error}>No se encontró el billete solicitado.</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del viaje</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTicket(true)}
            tintColor="#F07820"
            colors={['#F07820']}
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.routeText}>{ticket.origin || 'Origen'} {'->'} {ticket.destination || 'Destino'}</Text>
          <Text style={styles.infoText}>Ruta: {ticket.routeCode || 'Sin código'}</Text>
          <Text style={styles.infoText}>Salida: {formatDate(ticket.departureAt)}</Text>
          <Text style={styles.infoText}>Llegada: {formatDate(ticket.arrivalAt)}</Text>
          <Text style={styles.infoText}>Estado: {mapStatusLabel(ticket.status)}</Text>
          <Text style={styles.infoText}>Agencia: {ticket.agencyName || 'Sin agencia'}</Text>
          <Text style={styles.infoText}>Pasajero: {ticket.passengerName || 'Sin nombre'}</Text>
          <Text style={styles.infoText}>Documento: {ticket.passengerIdentification || 'Sin documento'}</Text>
          <Text style={styles.infoText}>Referencia: {order?.referenceCode || 'Sin referencia'}</Text>
          <Text style={styles.uuidText}>Ticket UUID: {ticket.uuid}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>QR del billete</Text>
          {qrImageUri ? (
            <View style={styles.qrWrap}>
              <Image source={{ uri: qrImageUri }} style={styles.qrImage} resizeMode="contain" />
            </View>
          ) : (
            <Text style={styles.helper}>Este billete no tiene QR disponible (puede estar cancelado).</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gestion del billete</Text>
          <Text style={styles.helper}>
            Puedes mover este billete a otro viaje de la misma ruta, por fecha u horario distinto.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, (!isActiveTicket || busy || loadingAlternatives) && styles.btnDisabled]}
            disabled={!isActiveTicket || busy || loadingAlternatives}
            onPress={loadAlternatives}
          >
            <Text style={styles.primaryBtnText}>{loadingAlternatives ? 'Buscando horarios...' : 'Buscar horarios alternativos'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerBtn, (!isActiveTicket || busy) && styles.btnDisabled]}
            disabled={!isActiveTicket || busy}
            onPress={onCancelTicket}
          >
            <Text style={styles.dangerBtnText}>Cancelar billete</Text>
          </TouchableOpacity>

          {!isActiveTicket ? (
            <Text style={styles.noteText}>Solo billetes activos se pueden cambiar o cancelar.</Text>
          ) : null}
        </View>

        {alternatives.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Opciones disponibles</Text>
            {alternatives.map((alt) => {
              const seatsLeft = Math.max(0, Number(alt.capacity || 0) - Number(alt.seatsSold || 0))
              return (
                <View key={String(alt.id)} style={styles.altItem}>
                  <Text style={styles.altTitle}>{alt.origin || 'Origen'} {'->'} {alt.destination || 'Destino'}</Text>
                  <Text style={styles.altText}>Salida: {formatDate(alt.departureAt)}</Text>
                  <Text style={styles.altText}>Llegada: {formatDate(alt.arrivalAt)}</Text>
                  <Text style={styles.altText}>Plazas libres: {seatsLeft}</Text>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={() => onChangeToAlternative(Number(alt.id))}
                  >
                    <Text style={styles.secondaryBtnText}>Cambiar a este viaje</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EBEBEB',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 12,
    gap: 12,
  },
  topBar: {
    backgroundColor: '#F07820',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  centeredBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 70,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  routeText: {
    color: '#111827',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  uuidText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
  },
  helper: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  qrWrap: {
    marginTop: 4,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: '#F07820',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dangerBtn: {
    marginTop: 10,
    backgroundColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  noteText: {
    marginTop: 8,
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
  },
  altItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  altTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  altText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
})
