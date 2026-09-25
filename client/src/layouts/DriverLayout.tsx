import { Outlet } from 'react-router-dom';
import { BottomTabs } from '../components/layout/BottomTabs';
import { BellIcon, CarIcon, CoinIcon, ReceiptIcon, UserIcon } from '../components/layout/icons';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { t } from '../i18n';

const TABS = [
  { to: '/driver', label: t('Home'), icon: <CarIcon />, end: true },
  { to: '/driver/earnings', label: t('Earnings'), icon: <CoinIcon /> },
  { to: '/driver/trips', label: t('Trips'), icon: <ReceiptIcon /> },
  { to: '/driver/notifications', label: t('Inbox'), icon: <BellIcon /> },
  { to: '/driver/account', label: t('Account'), icon: <UserIcon /> },
];

export function DriverLayout() {
  const unread = useUnreadNotifications();
  return (
    <div className="min-h-screen bg-surface-alt">
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomTabs items={TABS.map((tab) => (tab.to === '/driver/notifications' ? { ...tab, badge: unread } : tab))} />
    </div>
  );
}
