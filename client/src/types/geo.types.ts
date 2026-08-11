export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  address: string;
}

export interface TrackedLocation extends LatLng {
  heading: number | null;
  at: string | null;
}
