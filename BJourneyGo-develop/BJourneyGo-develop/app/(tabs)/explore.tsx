import React from 'react'
import { FontAwesome5 } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getMyOrders } from '@/lib/api'

type TripStatus = 'Activo' | 'Expirado' | 'Completado'

type TripCard = {
  id: string
  ticketUuid: string
  route: string
  dateText: string
  agency: string
  status: TripStatus
}

type ApiTicket = {
  id?: number
  uuid?: string
  status?: string | null
  departureAt?: string | null
  arrivalAt?: string | null
  origin?: string | null
  destination?: string | null
  agencyName?: string | null
}

type ApiOrder = {
  id?: number
  status?: string | null
  tickets?: ApiTicket[]
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

function formatTripDate(value?: string | null) {
  const d = parseLocalDateTime(value)
  if (Number.isNaN(d.getTime())) return 'Fecha pendiente'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${year} a las ${hour}:${minute}`
}

function mapTripStatus(ticket: ApiTicket, orderStatus?: string | null): TripStatus {
  const t = String(ticket?.status || '').toUpperCase()
  const o = String(orderStatus || '').toUpperCase()
  const isCancelled = t === 'CANCELLED' || t === 'REFUNDED' || o === 'CANCELLED' || o === 'REFUNDED'
  if (isCancelled) return 'Expirado'

  const isCompletedByStatus = t === 'USED' || t === 'COMPLETED' || t === 'EXPIRED'
  if (isCompletedByStatus) return 'Completado'

  const arrival = parseLocalDateTime(ticket?.arrivalAt || null)
  if (!Number.isNaN(arrival.getTime()) && arrival.getTime() < Date.now()) {
    return 'Completado'
  }

  return 'Activo'
}

function mapOrdersToTrips(orders: ApiOrder[]): TripCard[] {
  const mapped: TripCard[] = []
  let fallbackIdx = 0
  for (const order of orders || []) {
    const orderId = Number(order?.id || 0)
    const tickets = Array.isArray(order?.tickets) ? order.tickets : []
    for (const t of tickets) {
      const ticketUuid = String(t?.uuid || '').trim()
      if (!ticketUuid) continue
      fallbackIdx += 1
      mapped.push({
        id: `${orderId}-${String(t?.id || fallbackIdx)}`,
        ticketUuid,
        route: `${t?.origin || 'Origen'} -> ${t?.destination || 'Destino'}`,
        dateText: formatTripDate(t?.departureAt || null),
        agency: t?.agencyName
          ? `Agencia contratada: ${t.agencyName}`
          : `Agencia contratada · Ref #${orderId || '-'}`,
        status: mapTripStatus(t, order?.status || null),
      })
    }
  }

  return mapped.sort((a, b) => {
    if (a.status === b.status) return 0
    if (a.status === 'Activo') return -1
    if (b.status === 'Activo') return 1
    if (a.status === 'Completado') return -1
    return 1
  })
}

function statusStyles(status: TripStatus) {
  if (status === 'Activo') {
    return { bg: '#DCFCE7', color: '#166534' }
  }
  if (status === 'Expirado') {
    return { bg: '#FEE2E2', color: '#B91C1C' }
  }
  return { bg: '#E5E7EB', color: '#374151' }
}

function TripItem({ item, onPress }: { item: TripCard; onPress: (uuid: string) => void }) {
  const badge = statusStyles(item.status)

  return (
    <TouchableOpacity style={styles.cardWrap} activeOpacity={0.85} onPress={() => onPress(item.ticketUuid)}>
      <View style={styles.accentBar} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.routeText}>{item.route}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <FontAwesome5 name="calendar-alt" size={14} color="#F07820" />
          <Text style={styles.dateText}>{item.dateText}</Text>
        </View>

        <Text style={styles.agencyText}>{item.agency}</Text>
        <Text style={styles.openDetailHint}>Toca para ver QR y gestionar billete</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function MyTripsScreen() {
  const router = useRouter()
  const [trips, setTrips] = React.useState<TripCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState('')

  const loadTrips = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const payload = await getMyOrders()
      const orders = Array.isArray(payload?.orders) ? payload.orders : []
      setTrips(mapOrdersToTrips(orders))
    } catch (e: any) {
      setError(String(e?.message || 'No se pudieron cargar tus viajes.'))
      setTrips([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      loadTrips(false)
    }, [loadTrips])
  )

  const openTicket = React.useCallback((ticketUuid: string) => {
    if (!ticketUuid) return
    router.push({ pathname: '/trip/[ticketUuid]', params: { ticketUuid } })
  }, [router])

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.menuBtn} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MIS VIAJES</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Proximos viajes</Text>
        {loading ? (
          <Text style={styles.helperText}>Cargando tus viajes...</Text>
        ) : error ? (
          <View>
            <Text style={[styles.helperText, styles.errorText]}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadTrips(false)} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : trips.length === 0 ? (
          <Text style={styles.helperText}>Aun no tienes viajes comprados.</Text>
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TripItem item={item} onPress={openTicket} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadTrips(true)}
                tintColor="#F07820"
                colors={['#F07820']}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EBEBEB',
  },
  topHeader: {
    height: 96,
    paddingTop: 14,
    backgroundColor: '#F07820',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 120,
    gap: 12,
  },
  helperText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  errorText: {
    color: '#B91C1C',
  },
  retryBtn: {
    marginTop: 10,
    backgroundColor: '#F07820',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  accentBar: {
    width: 6,
    backgroundColor: '#F07820',
  },
  cardContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  routeText: {
    flex: 1,
    color: '#111827',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  dateText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  agencyText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  openDetailHint: {
    marginTop: 10,
    color: '#F07820',
    fontSize: 12,
    fontWeight: '700',
  },
})
