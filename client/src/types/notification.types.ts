export type NotificationCategory = 'ride' | 'payment' | 'promo' | 'document' | 'safety' | 'system';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
