// helpers.ts (o booking.ts)
import type { TripItem, PassengerForm } from './types' // ajusta ruta si fuera necesario

export function seatsLeft(t: TripItem) {
  return Math.max(0, Number(t.capacity || 0) - Number(t.seatsSold || 0))
}

export function buildPassengers(quantity: number): PassengerForm[] {
  return Array.from({ length: quantity }).map(() => ({
    fullName: '',
    identification: '',
    phone: '',
    email: '',
  }))
}

export function normalizeTrips(payload: any): TripItem[] {
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