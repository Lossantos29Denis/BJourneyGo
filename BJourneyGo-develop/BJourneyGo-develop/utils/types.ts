// types.ts

export type BookingType = 'ONEWAY' | 'ROUNDTRIP'
export type Leg = 'outbound' | 'return'

export type TripItem = {
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

export type PassengerForm = {
  fullName: string
  identification: string
  phone: string
  email: string
}