export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  address: string;
}

export interface RouteOption {
  distanceKm: number;
  durationMin: number;
  path: LatLng[];
}

export interface RouteResult extends RouteOption {
  alternatives: RouteOption[];
}

export interface TrackedLocation extends LatLng {
  heading: number | null;
  at: string | null;
}
