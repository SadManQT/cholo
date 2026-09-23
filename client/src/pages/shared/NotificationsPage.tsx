import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import * as notificationsApi from '../../api/notifications.api';
import { BanknoteIcon, BellIcon, FileIcon, SirenIcon, TagIcon } from '../../components/layout/icons';
import { Button, EmptyState, Skeleton, toast } from '../../components/ui';
import { NOTIFICATIONS_CHANGED } from '../../hooks/useUnreadNotifications';
import type { AppNotification, NotificationCategory } from '../../types/notification.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';

const CATEGORY_ICON: Record<NotificationCategory, (props: { className?: string }) => React.ReactNode> = {
  ride: BellIcon, payment: BanknoteIcon, promo: TagIcon, document: FileIcon, safety: SirenIcon, system: BellIcon,
};

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await notificationsApi.listNotifications();
      setItems(result.data);
      setUnread(result.unread);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markAllRead() {
    try {
      await notificationsApi.markRead();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnread(0);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not mark notifications as read.'));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Notifications</h1>
          <p className="text-sm text-ink-500">{unread > 0 ? `${unread} unread` : 'You’re all caught up.'}</p>
        </div>
        {unread > 0 && <Button variant="secondary" onClick={() => void markAllRead()}>Mark all read</Button>}
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error ? (
        <EmptyState title="Notifications did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />
      ) : items.length === 0 ? (
        <EmptyState icon={<BellIcon className="h-10 w-10" />} title="No notifications yet" hint="Updates about your trips, documents and support requests will appear here." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((item, index) => {
            const Icon = CATEGORY_ICON[item.category] ?? BellIcon;
            return (
              <li key={item.id} className="animate-stagger-in flex gap-3 p-4" style={staggerStyle(index)}>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.readAt ? 'bg-surface-alt text-ink-500' : 'bg-cholo-50 text-cholo-700'}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${item.readAt ? 'text-ink-900' : 'font-semibold text-ink-900'}`}>{item.title}</p>
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cholo-700" aria-label="Unread" />}
                  </div>
                  {item.body && <p className="mt-0.5 text-sm text-ink-500">{item.body}</p>}
                  <p className="mt-1 text-xs text-ink-500">{formatDateTime(item.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
