import { useAuth } from '@/contexts/auth-context'
import { getActiveScannerSession, getScannerTrips, getTripPassengers, previewQrTicketInSession, startScannerSession, verifyQrTicketInSession } from '@/lib/api'
import { Redirect } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

type VerifyResult = {
  session?: {
    id?: number
    tripId?: number
    accessCode?: string
  }
  ticket?: {
    uuid?: string
    passengerName?: string
    passengerIdentification?: string
    passengerPhone?: string
    routeCode?: string
    origin?: string
    destination?: string
    departureAt?: string
    arrivalAt?: string
    referenceCode?: string
    status?: string
  }
  passengers?: Array<{
    fullName?: string
    identification?: string
    phone?: string
  }>
}

type ScannerTrip = {
  id: number
  routeCode?: string
  origin?: string
  destination?: string
  departureAt?: string
  arrivalAt?: string
}

type ActiveScannerSession = {
  id?: number
  tripId?: number
  accessCode?: string
  routeCode?: string
  origin?: string
  destination?: string
  departureAt?: string
  arrivalAt?: string
}

type TripPassenger = {
  uuid?: string
  passengerName?: string
  passengerIdentification?: string
  passengerPhone?: string
  status?: string
  verifiedAt?: string
}

function formatDate(value?: string) {
  if (!value) return '—'
  // Parse "YYYY-MM-DD HH:mm:ss" as local time, not UTC
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  let d: Date
  if (match) {
    const [, year, month, day, hour, minute, second] = match
    d = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    )
  } else {
    d = new Date(value)
  }
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScannerScreen() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const canScan = useMemo(
    () => Boolean(user?.scannerEnabled) || role === 'ADMIN' || role === 'SCANNER',
    [role, user?.scannerEnabled]
  )

  const [permission, requestPermission] = useCameraPermissions()
  const [trips, setTrips] = useState<ScannerTrip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [activeSession, setActiveSession] = useState<ActiveScannerSession | null>(null)
  const [tripPassengers, setTripPassengers] = useState<TripPassenger[]>([])
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [manualPayload, setManualPayload] = useState('')
  const [presentedId, setPresentedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<VerifyResult | null>(null)
  const [recentPayload, setRecentPayload] = useState('')
  const [pendingPayload, setPendingPayload] = useState('')
  const [previewResult, setPreviewResult] = useState<VerifyResult | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    void bootstrapScanner()
  }, [])

  async function bootstrapScanner() {
    setLoadingSetup(true)
    try {
      const [tripResp, sessionResp] = await Promise.all([
        getScannerTrips(),
        getActiveScannerSession(),
      ])
      const fetchedTrips = Array.isArray(tripResp?.trips) ? tripResp.trips : []
      setTrips(fetchedTrips)

      const session = sessionResp?.session || null
      setActiveSession(session)
      if (session?.tripId) {
        setSelectedTripId(Number(session.tripId))
        const passengerResp = await getTripPassengers(Number(session.tripId))
        setTripPassengers(Array.isArray(passengerResp?.passengers) ? passengerResp.passengers : [])
      } else {
        setTripPassengers([])
      }
    } catch (e: any) {
      Alert.alert('Escáner', e?.message || 'No se pudo cargar la configuración de escáner.')
    } finally {
      setLoadingSetup(false)
    }
  }

  async function activateTripSession() {
    if (!selectedTripId) {
      Alert.alert('Escáner', 'Selecciona un viaje antes de iniciar sesión de escaneo.')
      return
    }
    setLoadingSetup(true)
    try {
      const resp = await startScannerSession({ tripId: selectedTripId, accessCode: accessCode || undefined })
      const session = resp?.session || null
      setActiveSession(session)
      if (session?.tripId) {
        const passengerResp = await getTripPassengers(Number(session.tripId))
        setTripPassengers(Array.isArray(passengerResp?.passengers) ? passengerResp.passengers : [])
      } else {
        setTripPassengers([])
      }
      const reused = Boolean(resp?.reused)
      Alert.alert('Escáner', reused ? 'Ya tenías una sesión activa para este viaje.' : 'Sesión de viaje activada correctamente.')
    } catch (e: any) {
      Alert.alert('Escáner', e?.message || 'No se pudo activar la sesión del viaje.')
    } finally {
      setLoadingSetup(false)
    }
  }

  async function openPreview(payload: string) {
    if (!payload || busy || previewLoading) return
    if (!activeSession?.id || !activeSession?.tripId) {
      Alert.alert('Escáner', 'Primero debes activar una sesión de viaje.')
      return
    }

    setPreviewLoading(true)
    try {
      const json = await previewQrTicketInSession({
        qrPayload: payload,
        tripId: Number(activeSession.tripId),
        scannerSessionId: Number(activeSession.id),
        accessCode: activeSession.accessCode,
      })
      setPendingPayload(payload)
      setPreviewResult(json)
      setPreviewVisible(true)
    } catch (e: any) {
      Alert.alert('Error de lectura QR', e?.message || 'No se pudo leer el contenido del QR.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function runVerification(payload: string) {
    if (!payload || busy) return
    if (!activeSession?.id || !activeSession?.tripId) {
      Alert.alert('Escáner', 'Primero debes activar una sesión de viaje.')
      return
    }
    setBusy(true)
    try {
      const json = await verifyQrTicketInSession({
        qrPayload: payload,
        presentedId: presentedId || undefined,
        tripId: Number(activeSession.tripId),
        scannerSessionId: Number(activeSession.id),
        accessCode: activeSession.accessCode,
      })
      setLastResult(json)
      const passengerResp = await getTripPassengers(Number(activeSession.tripId))
      setTripPassengers(Array.isArray(passengerResp?.passengers) ? passengerResp.passengers : [])
      Alert.alert('Billete validado', 'El QR se ha verificado correctamente.')
    } catch (e: any) {
      Alert.alert('Error de validacion', e?.message || 'No se pudo validar el billete.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPreviewAndVerify() {
    if (!pendingPayload) {
      setPreviewVisible(false)
      setPreviewResult(null)
      return
    }

    setPreviewVisible(false)
    const payload = pendingPayload
    setPendingPayload('')
    await runVerification(payload)
    setPreviewResult(null)
  }

  if (!user) return <Redirect href="/login" />
  if (!canScan) return <Redirect href="/(tabs)/home" />

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.topHeader}>
        <Text style={styles.headerText}>ESCANER QR</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>1) Selecciona el viaje a operar</Text>
        <View style={styles.tripListWrap}>
          {trips.length === 0 ? (
            <Text style={styles.helper}>No hay viajes disponibles para escaneo.</Text>
          ) : (
            <ScrollView
              style={{ flexGrow: 0 }}
              nestedScrollEnabled
              contentContainerStyle={{ paddingVertical: 2 }}
            >
              {trips.map((trip) => {
                const selected = selectedTripId === Number(trip.id)
                const isActive = Number(activeSession?.tripId || 0) === Number(trip.id)
                return (
                  <TouchableOpacity
                    key={String(trip.id)}
                    style={[styles.tripItem, selected && styles.tripItemSelected]}
                    onPress={() => setSelectedTripId(Number(trip.id))}
                  >
                    <View style={styles.tripHeaderRow}>
                      <Text style={styles.tripTitle}>{(trip.origin || '—') + ' -> ' + (trip.destination || '—')}</Text>
                      {isActive ? <Text style={styles.activeBadge}>ACTIVO</Text> : null}
                    </View>
                    <Text style={styles.tripMeta}>ID {trip.id} • {trip.routeCode || 'Sin código'}</Text>
                    <Text style={styles.tripMeta}>Salida: {formatDate(trip.departureAt)}</Text>
                    <Text style={styles.tripMeta}>Llegada: {formatDate(trip.arrivalAt)}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>
        {/* <View style={styles.tripListWrap}>
          {trips.length === 0 ? (
            <Text style={styles.helper}>No hay viajes disponibles para escaneo.</Text>
          ) : (
            trips.map((trip) => {
              const selected = selectedTripId === Number(trip.id)
              const isActive = Number(activeSession?.tripId || 0) === Number(trip.id)
              return (
                <TouchableOpacity
                  key={String(trip.id)}
                  style={[styles.tripItem, selected && styles.tripItemSelected]}
                  onPress={() => setSelectedTripId(Number(trip.id))}
                >
                  <View style={styles.tripHeaderRow}>
                    <Text style={styles.tripTitle}>{(trip.origin || '—') + ' -> ' + (trip.destination || '—')}</Text>
                    {isActive ? <Text style={styles.activeBadge}>ACTIVO</Text> : null}
                  </View>
                  <Text style={styles.tripMeta}>ID {trip.id} • {trip.routeCode || 'Sin código'}</Text>
                  <Text style={styles.tripMeta}>Salida: {formatDate(trip.departureAt)}</Text>
                  <Text style={styles.tripMeta}>Llegada: {formatDate(trip.arrivalAt)}</Text>
                </TouchableOpacity>
              )
            })
          )}
        </View> */}
        <TextInput
          style={[styles.input, { marginTop: 10 }]}
          placeholder="Código de acceso (opcional)"
          value={accessCode}
          onChangeText={(v) => setAccessCode(String(v || '').toUpperCase())}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={[styles.primaryBtn, loadingSetup && styles.disabledBtn]} onPress={activateTripSession} disabled={loadingSetup}>
          <Text style={styles.primaryBtnText}>{loadingSetup ? 'Configurando...' : 'Activar sesión de viaje'}</Text>
        </TouchableOpacity>
        {activeSession?.id ? (
          <View style={styles.sessionCard}>
            <Text style={styles.resultTitle}>Sesión activa</Text>
            <Text style={styles.resultText}>Sesión: #{activeSession.id}</Text>
            <Text style={styles.resultText}>Viaje ID: {activeSession.tripId || '—'}</Text>
            <Text style={styles.resultText}>Código: {activeSession.accessCode || '—'}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Documento presentado (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="DNI / ID"
          value={presentedId}
          onChangeText={setPresentedId}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.cameraWrap}>
        {!permission ? (
          <Text style={styles.helper}>Comprobando permisos de camara...</Text>
        ) : permission.granted ? (
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(event) => {
              const payload = String(event?.data || '').trim()
              if (!payload) return
              if (payload === recentPayload) return
              setRecentPayload(payload)
              void openPreview(payload)
              setTimeout(() => setRecentPayload(''), 1800)
            }}
          />
        ) : (
          <View style={styles.centeredCameraPlaceholder}>
            <Text style={styles.helper}>Necesitamos permiso de camara para escanear QR.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => requestPermission()}>
              <Text style={styles.primaryBtnText}>Permitir camara</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Entrada manual del QR</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Pega aqui el contenido del QR"
          value={manualPayload}
          onChangeText={setManualPayload}
          multiline
        />
        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.disabledBtn]}
          disabled={busy}
          onPress={() => openPreview(String(manualPayload || '').trim())}
        >
          <Text style={styles.primaryBtnText}>{busy || previewLoading ? 'Procesando...' : 'Previsualizar y verificar'}</Text>
        </TouchableOpacity>
      </View>

      {lastResult?.ticket ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Ultimo billete validado</Text>
          <Text style={styles.resultText}>Nombre: {lastResult.ticket.passengerName || '—'}</Text>
          <Text style={styles.resultText}>DNI: {lastResult.ticket.passengerIdentification || '—'}</Text>
          <Text style={styles.resultText}>Telefono: {lastResult.ticket.passengerPhone || '—'}</Text>
          <Text style={styles.resultText}>Ruta: {(lastResult.ticket.origin || '—') + ' -> ' + (lastResult.ticket.destination || '—')}</Text>
          <Text style={styles.resultText}>Codigo: {lastResult.ticket.routeCode || '—'}</Text>
          <Text style={styles.resultText}>Salida: {formatDate(lastResult.ticket.departureAt)}</Text>
          <Text style={styles.resultText}>Llegada: {formatDate(lastResult.ticket.arrivalAt)}</Text>
          <Text style={styles.resultText}>Referencia: {lastResult.ticket.referenceCode || '—'}</Text>
          <Text style={styles.resultText}>UUID: {lastResult.ticket.uuid || '—'}</Text>
          <Text style={styles.resultText}>Estado: {lastResult.ticket.status || 'USED'}</Text>
        </View>
      ) : null}

      {activeSession?.tripId ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Pasajeros del viaje activo</Text>
          {tripPassengers.length === 0 ? (
            <Text style={styles.resultText}>No hay pasajeros cargados para este viaje.</Text>
          ) : (
            tripPassengers.slice(0, 80).map((p, idx) => (
              <Text key={`${p.uuid || 'p'}-${idx}`} style={styles.resultText}>
                {(p.passengerName || `Pasajero ${idx + 1}`) + ' • ' + (p.passengerIdentification || 'ID sin registrar') + ' • ' + (p.status || 'ACTIVE')}
              </Text>
            ))
          )}
        </View>
      ) : null}

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.resultTitle}>Previsualización de viajero</Text>
            <Text style={styles.resultText}>Nombre: {previewResult?.ticket?.passengerName || '—'}</Text>
            <Text style={styles.resultText}>DNI: {previewResult?.ticket?.passengerIdentification || '—'}</Text>
            <Text style={styles.resultText}>Teléfono: {previewResult?.ticket?.passengerPhone || '—'}</Text>
            <Text style={styles.resultText}>Ruta: {(previewResult?.ticket?.origin || '—') + ' -> ' + (previewResult?.ticket?.destination || '—')}</Text>
            <Text style={styles.resultText}>Salida: {formatDate(previewResult?.ticket?.departureAt)}</Text>
            <Text style={styles.resultText}>Referencia: {previewResult?.ticket?.referenceCode || '—'}</Text>
            <Text style={styles.resultText}>UUID: {previewResult?.ticket?.uuid || '—'}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnNeutral]}
                onPress={() => {
                  setPreviewVisible(false)
                  setPreviewResult(null)
                  setPendingPayload('')
                }}
              >
                <Text style={styles.modalBtnNeutralText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => { void confirmPreviewAndVerify() }}
              >
                <Text style={styles.modalBtnPrimaryText}>Cerrar y verificar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F4F4' },
  topHeader: {
    backgroundColor: '#F07820',
    height: 96,
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 36 : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { fontSize: 22, color: '#fff', fontWeight: '800' },
  section: { paddingHorizontal: 14, paddingTop: 12 },
  label: { fontWeight: '700', color: '#1F2937', marginBottom: 6 },
  tripListWrap: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 8,
    flexShrink: 1,
  },
  tripItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  tripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activeBadge: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#16A34A',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    fontWeight: '800',
  },
  tripItemSelected: {
    borderColor: '#F0833F',
    backgroundColor: '#FFF7ED',
  },
  tripTitle: { fontWeight: '800', color: '#111827' },
  tripMeta: { fontSize: 12, color: '#4B5563', marginTop: 2 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  cameraWrap: {
    marginTop: 12,
    marginHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#111827',
  },
  camera: { width: '100%', height: 220 },
  helper: { color: '#374151', textAlign: 'center', padding: 12 },
  centeredCameraPlaceholder: { padding: 14, backgroundColor: '#fff' },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: '#F0833F',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
  resultCard: {
    margin: 14,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 12,
    gap: 3,
  },
  resultTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  resultText: { fontSize: 13, color: '#111827' },
  sessionCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 14,
    gap: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalBtnNeutral: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  modalBtnPrimary: {
    backgroundColor: '#F0833F',
  },
  modalBtnNeutralText: { color: '#111827', fontWeight: '700' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '800' },
})
