import { useEffect, useState } from 'react';
import * as notificationsApi from '../api/notifications.api';
import { toast } from '../components/ui';
import { useSocket } from '../context/socket';

const POLL_MS = 60_000;
export const NOTIFICATIONS_CHANGED = 'cholo:notifications-changed';

// The server pushes `notification:new` over the socket the moment one is saved; the poll is a fallback
// for when the socket is down.
export function useUnreadNotifications() {
  const { socket } = useSocket();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      notificationsApi.listNotifications()
        .then((result) => { if (!cancelled) setUnread(result.unread); })
        .catch(() => {});
    };
    const onNew = (payload: { title?: string }) => {
      refresh();
      if (payload?.title && document.visibilityState === 'visible') toast.info(payload.title);
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    socket?.on('notification:new', onNew);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      socket?.off('notification:new', onNew);
    };
  }, [socket]);

  return unread;
}
