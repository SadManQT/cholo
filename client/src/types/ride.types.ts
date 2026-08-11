import type { LatLng, Place, TrackedLocation } from './geo.types';

export type RideRequestStatus = 'pending' | 'searching' | 'matched' | 'expired' | 'cancelled';
export type TripStatus = 'assigned' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentIntent = 'cash' | 'wallet' | 'bkash' | 'nagad' | 'card';
export type ParticipantRole = 'passenger' | 'driver';

export interface City {
  id: number;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  launchedAt: string | null;
}

export interface VehicleCategory {
  id: number;
  name: string;
  description: string | null;
  seatCapacity: number | null;
  iconUrl: string | null;
  sortOrder: number;
}

export interface RideQuote {
  cityId: number;
  categoryId: number;
  currency: 'BDT';
  distanceKm: number;
  durationMin: number;
  surgeMultiplier: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  waitingFare: number;
  surgeAmount: number;
  bookingFee: number;
  discountAmount: number;
  totalFare: number;
}

export interface RideRequest {
  publicId: string;
  status: RideRequestStatus;
  quote: {
    estFare: number | string;
    estDiscount?: number;
    estPayable?: number;
    currency: 'BDT';
    estDistanceKm: number;
    estDurationMin: number;
    surgeMultiplier: number | string;
  };
  pickup?: Place;
  dropoff?: Place;
  paymentIntent?: PaymentIntent;
  requestedAt: string;
  expiresAt: string | null;
  cancelledAt?: string | null;
  tripCode?: string | null;
}

export interface RideOffer {
  id: string;
  requestId: string;
  requestPublicId: string;
  driverDistanceKm: number;
  offeredAt: string;
  expiresAt: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  estFare: number;
  estDistanceKm: number;
  estDurationMin: number;
  categoryName: string;
  passengerRating: string;
}

export interface AcceptedOffer {
  trip: {
    publicCode: string;
    status: TripStatus;
    pickup: Place;
    passenger: { name: string; rating: string };
  };
}

export interface DriverStatus {
  userId: string;
  verificationStatus: string;
  availabilityStatus: 'offline' | 'online' | 'on_trip' | 'break';
  currentLat: string | number | null;
  currentLng: string | number | null;
  heading: string | number | null;
  lastPingAt: string | null;
  activeVehicle: {
    id: string;
    registrationNo: string;
    verificationStatus: string;
  } | null;
}

export interface DriverAvailability {
  status: DriverStatus['availabilityStatus'];
  currentLat: string | number | null;
  currentLng: string | number | null;
  heading: string | number | null;
  currentZoneId: number | null;
  lastPingAt: string | null;
  updatedAt: string;
}

export interface TripSummary {
  publicCode: string;
  status: TripStatus;
  participantRole: ParticipantRole;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  estFare: string;
  totalFare: string;
  currency: string;
  categoryName: string;
  counterpartyName: string;
  assignedAt: string;
  completedAt: string | null;
}

export interface TripParty {
  id: string;
  name: string;
  phone: string;
  photoUrl: string | null;
  rating: string;
}

export interface TripDetail {
  publicCode: string;
  requestPublicId: string;
  status: TripStatus;
  participantRole: ParticipantRole;
  cityName: string;
  categoryName: string;
  pickup: Place;
  dropoff: Place;
  estimate: {
    distanceKm: number;
    durationMin: number;
    fare: string;
    surgeMultiplier: string;
    paymentIntent: PaymentIntent;
  };
  passenger: TripParty;
  driver: TripParty;
  vehicle: {
    registrationNo: string;
    brand: string | null;
    model: string | null;
    color: string | null;
  };
  timeline: {
    assignedAt: string;
    arrivedAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
  };
  actual: {
    distanceKm: number | null;
    durationMin: number | null;
  };
  fare: {
    base: string;
    distance: string;
    time: string;
    waiting: string;
    surge: string;
    bookingFee: string;
    discount: string;
    total: string;
    currency: string;
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
  };
  cancellation: {
    byRole: string;
    reasonCode: string;
    reasonText: string | null;
    fee: string;
    cancelledAt: string;
  } | null;
  history: Array<{
    fromStatus: TripStatus | null;
    toStatus: TripStatus;
    note: string | null;
    changedAt: string;
  }>;
}

export interface TripMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  messageType: 'text' | 'quick_reply';
  body: string;
  sentAt: string;
  readAt: string | null;
}

export interface SocketTripStatus {
  status: TripStatus;
  tripCode?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SocketLocation extends TrackedLocation {
  tripId?: string;
}

export interface CreateRideRequestInput {
  cityId: number;
  categoryId: number;
  pickup: Place;
  dropoff: Place;
  paymentIntent: PaymentIntent;
  promoCode?: string;
  womenOnly: boolean;
}

export type LocationUpdate = LatLng & { heading?: number; speedKmh?: number };
