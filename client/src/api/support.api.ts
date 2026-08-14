import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { MyDispute, TicketDetail, TicketSummary } from '../types/support.types';

export async function listTickets() {
  const response = await apiClient.get<ApiSuccess<TicketSummary[]>>('/support/tickets');
  return { data: response.data.data, meta: response.data.meta };
}

export async function createTicket(input: { category: string; subject: string; description: string; tripId?: string }) {
  const response = await apiClient.post<ApiSuccess<TicketSummary>>('/support/tickets', input);
  return response.data.data;
}

export async function getTicket(id: string) {
  const response = await apiClient.get<ApiSuccess<TicketDetail>>(`/support/tickets/${id}`);
  return response.data.data;
}

export async function addMessage(id: string, body: string) {
  const response = await apiClient.post<ApiSuccess<unknown>>(`/support/tickets/${id}/messages`, { body });
  return response.data.data;
}

export async function listDisputes() {
  const response = await apiClient.get<ApiSuccess<MyDispute[]>>('/disputes');
  return { data: response.data.data, meta: response.data.meta };
}

export async function createDispute(input: {
  tripPublicId: string;
  disputeType: string;
  description: string;
  disputedAmount?: number;
}) {
  const response = await apiClient.post<ApiSuccess<MyDispute>>('/disputes', input);
  return response.data.data;
}
