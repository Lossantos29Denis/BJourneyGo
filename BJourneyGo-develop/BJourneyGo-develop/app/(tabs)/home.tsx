import { createStripeCheckoutSession, getTrips } from '@/lib/api'
import { createURL } from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import React from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

type BookingType = 'ONEWAY' | 'ROUNDTRIP'
type Leg = 'outbound' | 'return'

type TripItem = {
  id: number
  routeCode?: string
  origin?: string
  destination?: string
  departureAt?: string
  arrivalAt?: string
  capacity?: number
  seatsSold?: number
  basePrice?: number
}

type PassengerForm = {
  fullName: string
  identification: string
  phone: string
  email: string
}

function parseLocalDateTime(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return new Date(NaN)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || '0'))
  }
  return new Date(raw)
}

function formatDateTime(value?: string) {
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

function durationLabel(start?: string, end?: string) {
  const a = parseLocalDateTime(start)
  const b = parseLocalDateTime(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'Duracion pendiente'
  const mins = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function seatsLeft(t: TripItem) {
  return Math.max(0, Number(t.capacity || 0) - Number(t.seatsSold || 0))
}

function buildPassengers(quantity: number): PassengerForm[] {
  return Array.from({ length: quantity }).map(() => ({
    fullName: '',
    identification: '',
    phone: '',
    email: '',
  }))
}

function normalizeTrips(payload: any): TripItem[] {
  const rows = Array.isArray(payload?.trips) ? payload.trips : []
  return rows
    .map((r: any) => ({
      id: Number(r.id),
      routeCode: r.routeCode || '',
      origin: r.origin || '',
      destination: r.destination || '',
      departureAt: r.departureAt || '',
      arrivalAt: r.arrivalAt || '',
      capacity: Number(r.capacity || 0),
      seatsSold: Number(r.seatsSold || 0),
      basePrice: Number(r.basePrice || 0),
    }))
    .filter((r: TripItem) => Number.isInteger(r.id) && r.id > 0)
}

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<TripItem[]>([])
  const [loadingSearch, setLoadingSearch] = React.useState(false)

  const [selectedTripForBooking, setSelectedTripForBooking] = React.useState<TripItem | null>(null)
  const bookingModalVisible = selectedTripForBooking !== null

  // Debounced search for trips matching origin or destination
  // Debounced search for trips matching route code, origin or destination.
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const query = searchQuery.trim()
      if (query.length < 2) {
        setSearchResults([])
        return
      }

      try {
        setLoadingSearch(true)
        const payload = await getTrips({ q: query })
        setSearchResults(normalizeTrips(payload))
      } catch (e) {
        console.warn('Search error:', e)
        setSearchResults([])
      } finally {
        setLoadingSearch(false)
      }
    }, 600) // 600ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <>
      <SafeAreaView style={styles.screen}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.menuBtn} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>≡</Text>
          </TouchableOpacity>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTextBJourney}>BJOURNEY</Text>
            <Text style={styles.logoTextGo}>GO</Text>
          </View>
        </View>

        {/* Search Bar - live filtering */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por origen, destino o ruta..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* If no search query, show promo and tiles */}
          {searchQuery.trim().length === 0 ? (
            <>
              <View style={styles.promoCard}>
                <Text style={styles.promoTitle}>Explora nuevas rutas en bus</Text>
                <Text style={styles.promoSubtitle}>Busca tu destino arriba para encontrar los mejores viajes.</Text>
              </View>

              <View style={styles.gridCard}>
                <TouchableOpacity style={styles.tile} activeOpacity={0.8}>
                  <View style={styles.tileImage}>
                    <Image source={require('@/assets/images/bus-1.png')} style={styles.tileImageInner} resizeMode="cover" />
                  </View>
                  <Text style={styles.tileTitle}>Explora nuevas rutas</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tile} activeOpacity={0.8}>
                  <View style={styles.tileImage}>
                    <Image source={require('@/assets/images/bus-2.png')} style={styles.tileImageInner} resizeMode="cover" />
                  </View>
                  <Text style={styles.tileTitle}>Ofertas de ultima hora</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* Search Results */}
          {searchQuery.trim().length >= 2 ? (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Viajes disponibles</Text>
              {loadingSearch ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#F07820" />
                  <Text style={styles.loadingText}>Buscando viajes...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <Text style={styles.emptyText}>No encontramos viajes para "{searchQuery}"</Text>
              ) : (
                searchResults.map((trip) => {
                  const left = seatsLeft(trip)
                  return (
                    <View key={String(trip.id)} style={styles.tripCard}>
                      <Text style={styles.tripRoute}>
                        {trip.origin || 'Origen'} → {trip.destination || 'Destino'}
                      </Text>
                      <Text style={styles.tripMeta}>Ruta: {trip.routeCode || 'Sin código'}</Text>
                      <Text style={styles.tripMeta}>Salida: {formatDateTime(trip.departureAt)}</Text>
                      <Text style={styles.tripMeta}>Llegada: {formatDateTime(trip.arrivalAt)}</Text>
                      <Text style={styles.tripMeta}>Duración: {durationLabel(trip.departureAt, trip.arrivalAt)}</Text>
                      <Text style={styles.tripMeta}>Precio: EUR {Number(trip.basePrice || 0).toFixed(2)} por persona</Text>
                      <Text style={[styles.tripMeta, left > 0 ? styles.seatsAvailable : styles.seatsUnavailable]}>
                        Plazas libres: {left}
                      </Text>
                      <TouchableOpacity
                        style={[styles.primaryBtn, left === 0 && styles.btnDisabled]}
                        disabled={left === 0}
                        onPress={() => setSelectedTripForBooking(trip)}
                      >
                        <Text style={styles.primaryBtnText}>Reservar viaje</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Booking Modal */}
      {selectedTripForBooking && (
        <BookingModal trip={selectedTripForBooking} onClose={() => setSelectedTripForBooking(null)} visible={bookingModalVisible} />
      )}
    </>
  )
}

// ─── Booking Modal Component ──────────────────────────────────────────────────
interface BookingModalProps {
  trip: TripItem
  visible: boolean
  onClose: () => void
}

function BookingModal({ trip, visible, onClose }: BookingModalProps) {
  const [bookingType, setBookingType] = React.useState<BookingType>('ONEWAY')
  const [returnTrip, setReturnTrip] = React.useState<TripItem | null>(null)
  const [quantityText, setQuantityText] = React.useState('1')
  const [passengers, setPassengers] = React.useState<PassengerForm[]>(buildPassengers(1))
  const [submitting, setSubmitting] = React.useState(false)
  const [selectingLeg, setSelectingLeg] = React.useState<Leg>('outbound')
  const [returnResults, setReturnResults] = React.useState<TripItem[]>([])
  const [loadingReturn, setLoadingReturn] = React.useState(false)

  const quantity = Math.max(1, Math.min(10, Math.floor(Number(quantityText) || 1)))

  const updatePassenger = React.useCallback((index: number, patch: Partial<PassengerForm>) => {
    setPassengers((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }, [])

  const onSelectReturnTrip = React.useCallback(async () => {
    if (bookingType !== 'ROUNDTRIP' || selectingLeg !== 'outbound') return
    try {
      setLoadingReturn(true)
      const payload = await getTrips({
        origin: trip.destination || '',
        destination: trip.origin || '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      })
      const trips = normalizeTrips(payload)
      setReturnResults(trips.filter(t => Number(t.id) !== Number(trip.id)))
      setSelectingLeg('return')
    } catch (e: any) {
      Alert.alert('Error', 'No se pudieron cargar viajes de vuelta.')
    } finally {
      setLoadingReturn(false)
    }
  }, [bookingType, selectingLeg, trip])

  const onCheckout = React.useCallback(async () => {
    if (!trip) return
    if (bookingType === 'ROUNDTRIP' && !returnTrip) {
      Alert.alert('Booking', 'Selecciona un viaje de vuelta.')
      return
    }

    const parsed = passengers.map((p, index) => {
      const fullName = String(p.fullName || '').trim()
      const identification = String(p.identification || '').trim()
      const phone = String(p.phone || '').trim()
      const email = String(p.email || '').trim().toLowerCase()

      if (!fullName) throw new Error(`Falta el nombre del pasajero ${index + 1}`)
      if (!identification) throw new Error(`Falta la identificacion del pasajero ${index + 1}`)
      if (index === 0 && !phone) throw new Error('El telefono es obligatorio')
      if (index === 0 && !email) throw new Error('El correo es obligatorio')

      return {
        fullName,
        identification,
        phone: phone || null,
        email: index === 0 ? email : null,
        isContact: index === 0,
      }
    })

    try {
      setSubmitting(true)
      const payload: any = {
        quantity,
        passengers: parsed,
        contactEmail: String(parsed[0]?.email || ''),
        contactPhone: String(parsed[0]?.phone || ''),
        successUrl: createURL('/payment/result?status=success'),
        cancelUrl: createURL('/payment/result?status=cancelled'),
      }

      if (bookingType === 'ROUNDTRIP') {
        payload.outboundTripId = Number(trip.id)
        payload.returnTripId = Number(returnTrip?.id || 0)
      } else {
        payload.tripId = Number(trip.id)
      }

      const checkout = await createStripeCheckoutSession(payload)
      const url = String(checkout?.url || '')
      if (!url) throw new Error('No se recibio URL de pago')
      if (Platform.OS === 'web') {
        const canOpen = await Linking.canOpenURL(url)
        if (!canOpen) throw new Error('No se pudo abrir la pasarela de pago')
        await Linking.openURL(url)
      } else {
        const redirectUrl = createURL('/payment/result')
        const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl)
        if (result.type === 'cancel') return
      }
      onClose()
    } catch (e: any) {
      Alert.alert('Pago', e?.message || 'No se pudo iniciar el pago.')
    } finally {
      setSubmitting(false)
    }
  }, [bookingType, passengers, quantity, returnTrip, trip, onClose])

  const onOpen = React.useCallback(() => {
    setBookingType('ONEWAY')
    setReturnTrip(null)
    setQuantityText('1')
    setPassengers(buildPassengers(1))
    setSelectingLeg('outbound')
    setReturnResults([])
  }, [])

  React.useEffect(() => {
    if (visible) onOpen()
  }, [visible, onOpen])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseBtn}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Reservar Viaje</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          {/* Trip Summary */}
          <View style={styles.tripSummaryCard}>
            <Text style={styles.tripSummaryTitle}>Detalles del Viaje</Text>
            <Text style={styles.tripSummaryText}>{trip.origin} → {trip.destination}</Text>
            <Text style={styles.tripSummaryMeta}>Salida: {formatDateTime(trip.departureAt)}</Text>
            <Text style={styles.tripSummaryMeta}>Llegada: {formatDateTime(trip.arrivalAt)}</Text>
            <Text style={styles.tripSummaryMeta}>Duración: {durationLabel(trip.departureAt, trip.arrivalAt)}</Text>
            <Text style={styles.tripSummaryMeta}>Precio: EUR {Number(trip.basePrice || 0).toFixed(2)} por persona</Text>
            <Text style={styles.tripSummaryMeta}>Plazas libres: {seatsLeft(trip)}</Text>
          </View>

          {/* Booking Type Selection */}
          <View style={styles.bookingCard}>
            <Text style={styles.bookingCardTitle}>Tipo de viaje</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, bookingType === 'ONEWAY' && styles.segmentBtnActive]}
                onPress={() => {
                  setBookingType('ONEWAY')
                  setReturnTrip(null)
                }}
              >
                <Text style={[styles.segmentText, bookingType === 'ONEWAY' && styles.segmentTextActive]}>Solo ida</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, bookingType === 'ROUNDTRIP' && styles.segmentBtnActive]}
                onPress={() => setBookingType('ROUNDTRIP')}
              >
                <Text style={[styles.segmentText, bookingType === 'ROUNDTRIP' && styles.segmentTextActive]}>Ida y vuelta</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Return Trip Selection for Roundtrip */}
          {bookingType === 'ROUNDTRIP' && selectingLeg === 'outbound' && (
            <View style={styles.bookingCard}>
              <Text style={styles.bookingCardTitle}>Seleccionar viaje de vuelta</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onSelectReturnTrip} disabled={loadingReturn}>
                <Text style={styles.primaryBtnText}>{loadingReturn ? 'Buscando...' : 'Buscar viajes de vuelta'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {bookingType === 'ROUNDTRIP' && selectingLeg === 'return' && returnResults.length > 0 && (
            <View style={styles.bookingCard}>
              <Text style={styles.bookingCardTitle}>Viajes de vuelta disponibles</Text>
              {returnResults.map((retTrip) => (
                <View key={String(retTrip.id)} style={styles.tripOption}>
                  <Text style={styles.tripOptionRoute}>
                    {retTrip.origin} → {retTrip.destination}
                  </Text>
                  <Text style={styles.tripOptionMeta}>Salida: {formatDateTime(retTrip.departureAt)}</Text>
                  <Text style={styles.tripOptionMeta}>Llegada: {formatDateTime(retTrip.arrivalAt)}</Text>
                  <Text style={styles.tripOptionMeta}>EUR {Number(retTrip.basePrice || 0).toFixed(2)}/persona</Text>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setReturnTrip(retTrip)
                      setSelectingLeg('outbound')
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Elegir vuelta</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {bookingType === 'ROUNDTRIP' && returnTrip && (
            <View style={styles.returnSummary}>
              <Text style={styles.returnSummaryText}>
                Vuelta: {returnTrip.origin} → {returnTrip.destination}
              </Text>
              <Text style={styles.returnSummaryMeta}>Salida: {formatDateTime(returnTrip.departureAt)}</Text>
            </View>
          )}

          {/* Quantity Selection */}
          <View style={styles.bookingCard}>
            <Text style={styles.bookingCardTitle}>Cantidad de pasajeros</Text>
            <TextInput
              style={styles.input}
              placeholder="Pasajeros (1-10)"
              keyboardType="numeric"
              value={quantityText}
              onChangeText={setQuantityText}
            />
          </View>

          {/* Passenger Forms */}
          <View style={styles.bookingCard}>
            <Text style={styles.bookingCardTitle}>Información de pasajeros</Text>
            {passengers.map((p, index) => (
              <View key={`passenger-${index}`} style={styles.passengerCard}>
                <Text style={styles.passengerTitle}>
                  Pasajero {index + 1}{index === 0 ? ' (Contacto)' : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre completo"
                  value={p.fullName}
                  onChangeText={(v) => updatePassenger(index, { fullName: v })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Identificación"
                  value={p.identification}
                  onChangeText={(v) => updatePassenger(index, { identification: v })}
                />
                <TextInput
                  style={styles.input}
                  placeholder={index === 0 ? 'Teléfono (contacto)' : 'Teléfono (opcional)'}
                  keyboardType="phone-pad"
                  value={p.phone}
                  onChangeText={(v) => updatePassenger(index, { phone: v })}
                />
                {index === 0 && (
                  <TextInput
                    style={styles.input}
                    placeholder="Correo de contacto"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={p.email}
                    onChangeText={(v) => updatePassenger(index, { email: v })}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Checkout Button */}
          <View style={{ marginBottom: 30 }}>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.largeBtn, submitting && styles.btnDisabled]}
              onPress={onCheckout}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>{submitting ? 'Procesando...' : 'Ir al pago'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  topHeader: {
    backgroundColor: '#1A2E6C',
    height: 88,
    paddingTop: 34,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
  logo: { width: 44, height: 44, marginLeft: 6 },
  logoTextContainer: { flexDirection: 'row', alignItems: 'baseline', marginLeft: 8 },
  logoTextBJourney: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  logoTextGo: { fontSize: 20, fontWeight: '800', color: '#FF6B35', marginLeft: 4 },
  searchContainer: { paddingHorizontal: 12, marginTop: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e6e9ef',
  },
  searchIcon: { fontSize: 20, marginRight: 8, color: '#94a3b8' },
  searchInput: { flex: 1, height: 44, color: '#0f172a', fontSize: 15 },
  content: { padding: 16, paddingBottom: 120 },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 22,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  promoTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  promoSubtitle: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 6 },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tile: { width: '48%', alignItems: 'center', justifyContent: 'flex-start' },
  tileImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e6eef8',
  },
  tileImageInner: { width: '100%', height: '100%', borderRadius: 10 },
  tileTitle: { marginTop: 12, fontWeight: '900', color: '#0f172a', textAlign: 'center', fontSize: 14 },
  resultsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resultsTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  tripCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginTop: 8,
  },
  tripRoute: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  tripMeta: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  seatsAvailable: { color: '#059669', fontWeight: '600' },
  seatsUnavailable: { color: '#dc2626', fontWeight: '600' },
  loadingRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#4b5563', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#6b7280', fontStyle: 'italic', marginTop: 8 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#F07820',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F07820',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#F07820', fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  // Modal Styles
  modalScreen: { flex: 1, backgroundColor: '#f1f5f9' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCloseBtn: { fontSize: 16, fontWeight: '700', color: '#F07820' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalContent: { padding: 16, paddingBottom: 50 },
  tripSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tripSummaryTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  tripSummaryText: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  tripSummaryMeta: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bookingCardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  segmentBtnActive: { borderColor: '#F07820', backgroundColor: '#fff7ed' },
  segmentText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#b45309' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  tripOption: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginTop: 8,
  },
  tripOptionRoute: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  tripOptionMeta: { fontSize: 12, color: '#6b7280', marginTop: 3 },
  returnSummary: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    padding: 12,
    marginBottom: 12,
  },
  returnSummaryText: { fontSize: 14, fontWeight: '700', color: '#1e40af' },
  returnSummaryMeta: { fontSize: 12, color: '#1e3a8a', marginTop: 4 },
  passengerCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginTop: 8,
  },
  passengerTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  largeBtn: { paddingVertical: 14, marginTop: 16 },
})
