export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RecentPlace {
  address: string;
  lat: number;
  lng: number;
  usedAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  priority: number;
}
