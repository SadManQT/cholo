import { useEffect, useState } from 'react';
import * as notificationsApi from '../api/notifications.api';

const POLL_MS = 60_000;
export const NOTIFICATIONS_CHANGED = 'cholo:notifications-changed';

// ponytail: polls once a minute; push over the existing socket if the inbox needs to feel instant.
export function useUnreadNotifications() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      notificationsApi.listNotifications()
        .then((result) => { if (!cancelled) setUnread(result.unread); })
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, []);

  return unread;
}
