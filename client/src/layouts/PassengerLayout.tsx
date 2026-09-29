import { Outlet } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomTabs } from '../components/layout/BottomTabs';
import { BellIcon, HomeIcon, ReceiptIcon, UserIcon, WalletIcon } from '../components/layout/icons';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { t } from '../i18n';

const TABS = [
  { to: '/', label: t('Book'), icon: <HomeIcon />, end: true },
  { to: '/trips', label: t('Trips'), icon: <ReceiptIcon /> },
  { to: '/wallet', label: t('Wallet'), icon: <WalletIcon /> },
  { to: '/notifications', label: t('Inbox'), icon: <BellIcon /> },
  { to: '/account', label: t('Account'), icon: <UserIcon /> },
];

export function PassengerLayout() {
  const unread = useUnreadNotifications();
  const items = TABS.map((tab) => (tab.to === '/notifications' ? { ...tab, badge: unread } : tab));
  return (
    <div className="min-h-screen bg-surface-alt">
      <AppHeader home="/" items={items} />
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
      <BottomTabs items={items} />
    </div>
  );
}
