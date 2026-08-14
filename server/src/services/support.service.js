import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as supportRepo from '../repositories/support.repository.js';
import { AppError } from '../utils/AppError.js';

function paginate(rows, query) {
  const total = rows[0]?.totalCount ?? 0;
  return {
    data: rows.map(({ totalCount: _totalCount, ...row }) => row),
    meta: { page: query.page, limit: query.limit, total },
  };
}

async function requireSupportAdmin(adminId, client) {
  const level = await adminRepo.getAccessLevel(adminId, client);
  if (!['super', 'ops', 'support'].includes(level)) {
    throw new AppError(403, 'FORBIDDEN_ACCESS_LEVEL');
  }
}

export async function createTicket(userId, input) {
  return withTransaction(async (client) => {
    let tripId = null;
    if (input.tripId) {
      tripId = await supportRepo.findParticipantTripId(input.tripId, userId, client);
      if (!tripId) throw new AppError(404, 'TRIP_NOT_FOUND');
    }
    const ticket = await supportRepo.insertTicket({ ...input, userId, tripId }, client);
    await supportRepo.insertMessage({
      ticketId: ticket.id,
      senderId: userId,
      body: input.description,
    }, client);
    return ticket;
  });
}

export async function listMine(userId, query) {
  return paginate(await supportRepo.listForUser(userId, query), query);
}

export async function getMine(userId, ticketId) {
  const ticket = await supportRepo.findOwned(ticketId, userId);
  if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND');
  const messages = await supportRepo.listMessages(ticket.id, false);
  return { ...ticket, messages };
}

export async function addUserMessage(userId, ticketId, input) {
  const ticket = await supportRepo.findOwned(ticketId, userId);
  if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND');
  if (['resolved', 'closed'].includes(ticket.status)) throw new AppError(409, 'TICKET_CLOSED');
  return supportRepo.insertMessage({ ...input, ticketId, senderId: userId, isInternalNote: false });
}

export async function listQueue(adminId, query) {
  await requireSupportAdmin(adminId);
  return paginate(await supportRepo.listQueue(query), query);
}

export async function getAdminTicket(adminId, ticketId) {
  await requireSupportAdmin(adminId);
  const ticket = await supportRepo.findById(ticketId);
  if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND');
  return { ...ticket, messages: await supportRepo.listMessages(ticketId, true) };
}

export async function updateTicket(adminId, ticketId, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireSupportAdmin(adminId, client);
    const ticket = await supportRepo.findById(ticketId, client, true);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND');
    if (ticket.status === 'closed') throw new AppError(409, 'TICKET_CLOSED');
    const updated = await supportRepo.updateTicket(ticketId, input, adminId, client);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress,
      action: 'SUPPORT_TICKET_UPDATED', entityType: 'support_tickets', entityId: ticketId,
      oldValue: { status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo },
      newValue: updated,
    }, client);
    return updated;
  });
}

export async function addAdminMessage(adminId, ticketId, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireSupportAdmin(adminId, client);
    const ticket = await supportRepo.findById(ticketId, client, true);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND');
    if (ticket.status === 'closed') throw new AppError(409, 'TICKET_CLOSED');
    const message = await supportRepo.insertMessage({ ...input, ticketId, senderId: adminId }, client);
    if (!input.isInternalNote && ticket.status === 'open') {
      await supportRepo.updateTicket(ticketId, { status: 'waiting_user' }, adminId, client);
    }
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress,
      action: input.isInternalNote ? 'SUPPORT_INTERNAL_NOTE_ADDED' : 'SUPPORT_REPLY_SENT',
      entityType: 'support_tickets', entityId: ticketId,
      oldValue: null, newValue: { messageId: message.id },
    }, client);
    return message;
  });
}
