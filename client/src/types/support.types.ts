export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketSummary {
  id: string;
  ticketNo: string;
  category: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  tripCode: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  userName?: string;
  userPhone?: string;
  assignedToName?: string | null;
}

export interface TicketMessage {
  id: string;
  senderId?: string;
  senderName?: string;
  body: string;
  attachmentUrl: string | null;
  isInternalNote: boolean;
  sentAt: string;
}

export interface TicketDetail extends TicketSummary {
  userId?: string;
  description: string;
  assignedTo?: string | null;
  closedAt: string | null;
  messages: TicketMessage[];
}

export interface MyDispute {
  id: string;
  disputeNo: string;
  tripCode: string;
  disputeType: string;
  description: string;
  disputedAmount: string | null;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}
