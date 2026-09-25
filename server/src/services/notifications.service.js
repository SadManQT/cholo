import { afterCommit } from '../config/db.js';
import * as notificationsRepo from '../repositories/notifications.repository.js';
import { getIO } from '../sockets/index.js';
import { userRoom } from '../sockets/rooms.js';

/**
 * Queue an in-app notification; pass the caller's transaction client so it commits with the change it
 * describes. Once committed, the user's open tabs get `notification:new` and refresh their inbox badge.
 */
export async function notify(userId, notification, client) {
  await notificationsRepo.insert({ userId, ...notification }, client);
  afterCommit(client, () => {
    getIO()?.to(userRoom(userId)).emit('notification:new', {
      category: notification.category,
      title: notification.title,
    });
  });
}

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
