// BookingModal.tsx
import React from 'react'
import * as WebBrowser from 'expo-web-browser'
import { createURL } from 'expo-linking'
import {homeStyles as styles} from '../styles/homestyles'
import { createStripeCheckoutSession, getTrips } from '@/lib/api'
import {
    Alert,
    Modal,
    SafeAreaView,
    View,
    Text,
    Linking,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Platform,
} from 'react-native'

import {
    buildPassengers,
    seatsLeft,
    normalizeTrips,
} from '../utils/booking' 

import {
   parseLocalDateTime,
   formatDateTime,
   durationLabel
} from '../utils/date'

import type { TripItem, PassengerForm, BookingType, Leg } from '../utils/types' 

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
    const [returnSearchError, setReturnSearchError] = React.useState('')

    const quantity = Math.max(1, Math.min(10, Math.floor(Number(quantityText) || 1)))
    const outboundPrice = Number(trip.basePrice || 0)
    const returnPrice = Number(returnTrip?.basePrice || 0)
    const unitTotal = bookingType === 'ROUNDTRIP' ? outboundPrice + returnPrice : outboundPrice
    const totalPrice = unitTotal * quantity

    const updatePassenger = React.useCallback((index: number, patch: Partial<PassengerForm>) => {
        setPassengers((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)))
    }, [])

    React.useEffect(() => {
        setPassengers((current) => {
            if (current.length === quantity) return current
            if (current.length < quantity) {
                return [...current, ...buildPassengers(quantity - current.length)]
            }
            return current.slice(0, quantity)
        })
    }, [quantity])

    const loadReturnTrips = React.useCallback(async () => {
        if (bookingType !== 'ROUNDTRIP') return
        try {
            setLoadingReturn(true)
            setReturnSearchError('')
            const outboundDepartureMs = parseLocalDateTime(trip.departureAt).getTime()

            const payload = await getTrips({
                origin: trip.destination || '',
                destination: trip.origin || '',
            })
            const trips = normalizeTrips(payload)
            const filtered = trips
                .filter((t) => Number(t.id) !== Number(trip.id))
                .filter((t) => {
                    if (Number.isNaN(outboundDepartureMs)) return true
                    const departureMs = parseLocalDateTime(t.departureAt).getTime()
                    return Number.isFinite(departureMs) && departureMs > outboundDepartureMs
                })
                .sort((a, b) => parseLocalDateTime(a.departureAt).getTime() - parseLocalDateTime(b.departureAt).getTime())
            setReturnResults(filtered)
            setSelectingLeg('return')
            if (filtered.length === 0) {
                setReturnSearchError('No existen viajes de vuelta posteriores a la ida para esta ruta.')
            }
        } catch (e: any) {
            setReturnResults([])
            setSelectingLeg('return')
            setReturnSearchError(e?.message || 'No se pudieron cargar viajes de vuelta.')
        } finally {
            setLoadingReturn(false)
        }
    }, [bookingType, trip])

    React.useEffect(() => {
        if (!visible) return
        if (bookingType === 'ROUNDTRIP') {
            setSelectingLeg('return')
            setReturnTrip(null)
            setReturnResults([])
            setReturnSearchError('Buscando viajes de vuelta más cercanos a la ida...')
            void loadReturnTrips()
            return
        }
        setLoadingReturn(false)
        setReturnSearchError('')
        setReturnResults([])
        setReturnTrip(null)
    }, [bookingType, loadReturnTrips, visible])

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
        setReturnSearchError('')
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
                        {bookingType === 'ROUNDTRIP' ? (
                            <>
                                <Text style={styles.tripSummaryMeta}>
                                    Vuelta: {returnTrip ? `${returnTrip.origin} → ${returnTrip.destination}` : 'Pendiente de selección'}
                                </Text>
                                <Text style={styles.tripSummaryMeta}>
                                    Total {returnTrip ? 'final' : 'provisional'}: {returnTrip ? `EUR ${totalPrice.toFixed(2)}` : 'pendiente de elegir la vuelta'}
                                </Text>
                            </>
                        ) : (
                            <Text style={styles.tripSummaryMeta}>
                                Total estimado: EUR {totalPrice.toFixed(2)} para {quantity} billetes
                            </Text>
                        )}
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
                                    setReturnResults([])
                                    setReturnSearchError('')
                                }}
                            >
                                <Text style={[styles.segmentText, bookingType === 'ONEWAY' && styles.segmentTextActive]}>Solo ida</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentBtn, bookingType === 'ROUNDTRIP' && styles.segmentBtnActive]}
                                onPress={() => {
                                    setBookingType('ROUNDTRIP')
                                    setSelectingLeg('return')
                                    setReturnTrip(null)
                                    setReturnResults([])
                                    setReturnSearchError('Buscando viajes de vuelta más cercanos a la ida...')
                                }}
                            >
                                <Text style={[styles.segmentText, bookingType === 'ROUNDTRIP' && styles.segmentTextActive]}>Ida y vuelta</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Return Trip Selection for Roundtrip */}
                    {bookingType === 'ROUNDTRIP' && (
                        <View style={styles.bookingCard}>
                            <Text style={styles.bookingCardTitle}>Seleccionar viaje de vuelta</Text>
                            {loadingReturn ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator color="#F07820" />
                                    <Text style={styles.loadingText}>Buscando viajes de vuelta...</Text>
                                </View>
                            ) : returnSearchError ? (
                                <Text style={styles.emptyText}>{returnSearchError}</Text>
                            ) : returnResults.length === 0 ? (
                                <Text style={styles.emptyText}>No existen viajes de vuelta disponibles.</Text>
                            ) : (
                                returnResults.map((retTrip) => (
                                    <View key={String(retTrip.id)} style={styles.tripOption}>
                                        <Text style={styles.tripOptionRoute}>
                                            {retTrip.origin} → {retTrip.destination}
                                        </Text>
                                        <Text style={styles.tripOptionMeta}>Salida: {formatDateTime(retTrip.departureAt)}</Text>
                                        <Text style={styles.tripOptionMeta}>Llegada: {formatDateTime(retTrip.arrivalAt)}</Text>
                                        <Text style={styles.tripOptionMeta}>Precio: EUR {Number(retTrip.basePrice || 0).toFixed(2)} por persona</Text>
                                        <Text style={styles.tripOptionMeta}>Total para {quantity} billetes: EUR {(Number(retTrip.basePrice || 0) * quantity).toFixed(2)}</Text>
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
                                ))
                            )}

                            <TouchableOpacity style={styles.secondaryBtn} onPress={loadReturnTrips} disabled={loadingReturn}>
                                <Text style={styles.secondaryBtnText}>{loadingReturn ? 'Buscando...' : 'Actualizar viajes de vuelta'}</Text>
                            </TouchableOpacity>
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

export default BookingModal