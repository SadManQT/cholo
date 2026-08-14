export interface DashboardStats {
  tripsToday: number;
  activeDrivers: number;
  pendingDrivers: number;
  requestedWithdrawals: number;
  openDisputes: number;
  openSos: number;
  grossRevenueMonth: string;
  platformRevenueMonth: string;
  trend: Array<{
    month: string;
    completedTrips: number;
    grossRevenue: string;
    platformRevenue: string;
  }>;
}

export interface ReviewDocument {
  id: string;
  docType: string;
  status: string;
  expiryDate: string | null;
  fileUrl: string;
  docNumber: string | null;
  rejectionReason: string | null;
}

export interface DriverApplication {
  id: string;
  publicId: string;
  fullName: string;
  phone: string;
  nidNumber: string;
  licenseNumber: string;
  licenseExpiry: string | null;
  verificationStatus: string;
  appliedAt: string;
  documents: ReviewDocument[];
}

export interface VehicleApplication {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  registrationNo: string;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  color: string | null;
  categoryName: string;
  verificationStatus: string;
  createdAt: string;
  documents: ReviewDocument[];
}

export interface AdminUserRow {
  id: string;
  publicId: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  lastLoginAt: string | null;
  walletBalance: string;
  currency: string;
  roles: string[];
  tripCount: number;
}

export interface PricingRule {
  id: string;
  cityId: number;
  cityName: string;
  categoryId: number;
  categoryName: string;
  baseFare: string;
  perKmRate: string;
  perMinRate: string;
  minimumFare: string;
  bookingFee: string;
  waitingPerMin: string;
  freeWaitMinutes: number;
  cancellationFee: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdByName: string | null;
  createdAt: string;
}

export interface PublishPricingRuleInput {
  cityId: number;
  categoryId: number;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  minimumFare: number;
  bookingFee: number;
  waitingPerMin: number;
  freeWaitMinutes: number;
  cancellationFee: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved_refunded' | 'resolved_no_action' | 'rejected';

export interface AdminDispute {
  id: string;
  disputeNo: string;
  tripCode: string;
  disputeType: string;
  description: string | null;
  disputedAmount: string | null;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  raisedByName: string;
  raisedByPhone: string;
  tripTotal: string;
  paymentStatus: string;
}

export type SosStatus = 'active' | 'acknowledged' | 'resolved' | 'false_alarm';

export interface SosAlert {
  id: string;
  status: SosStatus;
  lat: number;
  lng: number;
  triggeredAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  triggeredByName: string;
  triggeredByPhone: string;
  tripCode: string | null;
  acknowledgedByName: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}
