import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { EmergencyContact, RecentPlace, SavedPlace } from '../types/place.types';
import type { User } from '../types/user.types';

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<ApiSuccess<User>>('/me');
  return data.data;
}

export async function updateMe(input: {
  fullName?: string;
  email?: string;
  photoUrl?: string;
  preferredLanguage?: 'bn' | 'en';
}): Promise<User> {
  const { data } = await apiClient.patch<ApiSuccess<User>>('/me', input);
  return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/me/password', { currentPassword, newPassword });
}

export type PlaceInput = Omit<SavedPlace, 'id'>;

export async function listPlaces() {
  const { data } = await apiClient.get<ApiSuccess<{ saved: SavedPlace[]; recent: RecentPlace[] }>>('/me/places');
  return data.data;
}

export async function addPlace(input: PlaceInput) {
  const { data } = await apiClient.post<ApiSuccess<SavedPlace>>('/me/places', input);
  return data.data;
}

export async function updatePlace(id: string, input: Partial<PlaceInput>) {
  const { data } = await apiClient.patch<ApiSuccess<SavedPlace>>(`/me/places/${id}`, input);
  return data.data;
}

export async function removePlace(id: string) {
  await apiClient.delete(`/me/places/${id}`);
}

export async function listEmergencyContacts() {
  const { data } = await apiClient.get<ApiSuccess<EmergencyContact[]>>('/me/emergency-contacts');
  return data.data;
}

export async function addEmergencyContact(input: { name: string; phone: string; relationship?: string }) {
  const { data } = await apiClient.post<ApiSuccess<EmergencyContact>>('/me/emergency-contacts', input);
  return data.data;
}

export async function removeEmergencyContact(id: string) {
  await apiClient.delete(`/me/emergency-contacts/${id}`);
}

export interface FavoriteDriver {
  id: string;
  name: string;
  photoUrl: string | null;
  rating: string;
  since: string;
}

export async function listFavoriteDrivers() {
  const { data } = await apiClient.get<ApiSuccess<FavoriteDriver[]>>('/me/favorite-drivers');
  return data.data;
}

export async function setFavoriteDriver(driverId: string, favorite: boolean) {
  if (favorite) await apiClient.put(`/me/favorite-drivers/${driverId}`);
  else await apiClient.delete(`/me/favorite-drivers/${driverId}`);
}

export interface ReferralSummary {
  code: string | null;
  invited: number;
  rewarded: number;
  earned: number;
  bonus: number;
}

export async function getReferral() {
  const { data } = await apiClient.get<ApiSuccess<ReferralSummary>>('/me/referral');
  return data.data;
}

export async function deleteAccount(password: string) {
  await apiClient.delete('/me', { data: { password } });
}

export async function getTwoFactor() {
  const { data } = await apiClient.get<ApiSuccess<{ enabled: boolean; enabledAt: string | null }>>('/me/two-factor');
  return data.data;
}

export async function startTwoFactorSetup() {
  const { data } = await apiClient.post<ApiSuccess<{ secret: string; otpauthUrl: string; qrDataUrl: string }>>('/me/two-factor/setup');
  return data.data;
}

export async function enableTwoFactor(code: string) {
  await apiClient.post('/me/two-factor/enable', { code });
}

export async function disableTwoFactor(code: string) {
  await apiClient.post('/me/two-factor/disable', { code });
}
