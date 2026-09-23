import * as notificationsRepo from '../repositories/notifications.repository.js';

/** Queue an in-app notification; pass the caller's transaction client so it commits with the change it describes. */
export const notify = (userId, notification, client) => notificationsRepo.insert({ userId, ...notification }, client);

export async function listMine(userId, query) {
  const [rows, unread] = await Promise.all([
    notificationsRepo.listForUser(userId, query),
    notificationsRepo.countUnread(userId),
  ]);
  return {
    data: rows.map(({ totalCount: _totalCount, ...row }) => row),
    meta: { page: query.page, limit: query.limit, total: rows[0]?.totalCount ?? 0, unread },
  };
}

export async function markRead(userId, ids) {
  return { updated: await notificationsRepo.markRead(userId, ids) };
}
