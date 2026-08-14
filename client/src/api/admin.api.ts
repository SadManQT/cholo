import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { WithdrawalQueueRow, WithdrawalStatus } from '../types/earnings.types';
import type {
  AdminDispute,
  AdminUserRow,
  AuditLog,
  DashboardStats,
  DriverApplication,
  PricingRule,
  PublishPricingRuleInput,
  SosAlert,
  VehicleApplication,
} from '../types/admin.types';
import type { TicketDetail, TicketPriority, TicketStatus, TicketSummary } from '../types/support.types';

function collection<T>(response: { data: ApiSuccess<T[]> }) {
  return { data: response.data.data, meta: response.data.meta };
}

export async function getStats(cityId?: number) {
  const response = await apiClient.get<ApiSuccess<DashboardStats>>('/admin/stats', { params: { cityId } });
  return response.data.data;
}

export async function listDriverApplications(status = 'pending') {
  const response = await apiClient.get<ApiSuccess<DriverApplication[]>>('/admin/drivers', { params: { status, limit: 100 } });
  return collection(response);
}

export async function listVehicleApplications(status = 'pending') {
  const response = await apiClient.get<ApiSuccess<VehicleApplication[]>>('/admin/vehicles', { params: { status, limit: 100 } });
  return collection(response);
}

export async function reviewDocument(id: string, status: 'approved' | 'rejected', reason?: string, vehicle = false) {
  const path = vehicle ? 'vehicle-documents' : 'documents';
  const response = await apiClient.post<ApiSuccess<unknown>>(`/admin/${path}/${id}/review`, { status, ...(reason ? { reason } : {}) });
  return response.data.data;
}

export async function decideDriver(id: string, decision: 'approve' | 'reject', reason?: string) {
  const response = await apiClient.post<ApiSuccess<unknown>>(`/admin/drivers/${id}/${decision}`, reason ? { reason } : {});
  return response.data.data;
}

export async function decideVehicle(id: string, decision: 'approve' | 'reject', reason?: string) {
  const response = await apiClient.post<ApiSuccess<unknown>>(`/admin/vehicles/${id}/${decision}`, reason ? { reason } : {});
  return response.data.data;
}

export async function listUsers(params: { search?: string; status?: string; page?: number; limit?: number } = {}) {
  const response = await apiClient.get<ApiSuccess<AdminUserRow[]>>('/admin/users', { params });
  return collection(response);
}

export async function decideUser(id: string, decision: 'suspend' | 'reinstate', reason: string) {
  const response = await apiClient.post<ApiSuccess<AdminUserRow>>(`/admin/users/${id}/${decision}`, { reason });
  return response.data.data;
}

export async function listPricingRules(params: { cityId?: number; categoryId?: number; limit?: number } = {}) {
  const response = await apiClient.get<ApiSuccess<PricingRule[]>>('/admin/pricing-rules', { params });
  return collection(response);
}

export async function publishPricingRule(input: PublishPricingRuleInput) {
  const response = await apiClient.post<ApiSuccess<PricingRule>>('/admin/pricing-rules', input);
  return response.data.data;
}

export async function listDisputes(status?: string) {
  const response = await apiClient.get<ApiSuccess<AdminDispute[]>>('/admin/disputes', { params: { status, limit: 100 } });
  return collection(response);
}

export async function resolveDispute(id: string, input: { status: string; resolutionNote: string; refundAmount?: number }) {
  const response = await apiClient.post<ApiSuccess<AdminDispute>>(`/admin/disputes/${id}/resolve`, input);
  return response.data.data;
}

export async function listSos(status?: string) {
  const response = await apiClient.get<ApiSuccess<SosAlert[]>>('/admin/sos', { params: { status, limit: 100 } });
  return collection(response);
}

export async function acknowledgeSos(id: string) {
  const response = await apiClient.post<ApiSuccess<SosAlert>>(`/admin/sos/${id}/acknowledge`);
  return response.data.data;
}

export async function resolveSos(id: string, resolutionNote: string, status: 'resolved' | 'false_alarm' = 'resolved') {
  const response = await apiClient.post<ApiSuccess<SosAlert>>(`/admin/sos/${id}/resolve`, { status, resolutionNote });
  return response.data.data;
}

export async function listAuditLogs(params: { entityType?: string; action?: string; page?: number; limit?: number } = {}) {
  const response = await apiClient.get<ApiSuccess<AuditLog[]>>('/admin/audit-logs', { params });
  return collection(response);
}

export async function listSupportTickets(params: { status?: TicketStatus; priority?: TicketPriority; limit?: number } = {}) {
  const response = await apiClient.get<ApiSuccess<TicketSummary[]>>('/admin/support/tickets', { params });
  return collection(response);
}

export async function getSupportTicket(id: string) {
  const response = await apiClient.get<ApiSuccess<TicketDetail>>(`/admin/support/tickets/${id}`);
  return response.data.data;
}

export async function updateSupportTicket(id: string, input: { status?: TicketStatus; priority?: TicketPriority; assignedToMe?: boolean }) {
  const response = await apiClient.patch<ApiSuccess<TicketDetail>>(`/admin/support/tickets/${id}`, input);
  return response.data.data;
}

export async function addSupportMessage(id: string, body: string, isInternalNote = false) {
  const response = await apiClient.post<ApiSuccess<unknown>>(`/admin/support/tickets/${id}/messages`, { body, isInternalNote });
  return response.data.data;
}

export async function listWithdrawalQueue(params: {
  status?: WithdrawalStatus;
  page?: number;
  limit?: number;
} = {}) {
  const response = await apiClient.get<ApiSuccess<WithdrawalQueueRow[]>>('/admin/withdrawals', { params });
  return { data: response.data.data, meta: response.data.meta };
}

export async function approveWithdrawal(id: string) {
  const response = await apiClient.post<ApiSuccess<{ id: string; status: WithdrawalStatus }>>(
    `/admin/withdrawals/${id}/approve`,
  );
  return response.data.data;
}

export async function rejectWithdrawal(id: string, reason: string) {
  const response = await apiClient.post<ApiSuccess<{ id: string; status: WithdrawalStatus }>>(
    `/admin/withdrawals/${id}/reject`,
    { reason },
  );
  return response.data.data;
}
