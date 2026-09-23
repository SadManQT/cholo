import { Outlet } from 'react-router-dom';
import { BottomTabs } from '../components/layout/BottomTabs';
import { BellIcon, HomeIcon, ReceiptIcon, UserIcon, WalletIcon } from '../components/layout/icons';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

const TABS = [
  { to: '/', label: 'Book', icon: <HomeIcon />, end: true },
  { to: '/trips', label: 'Trips', icon: <ReceiptIcon /> },
  { to: '/wallet', label: 'Wallet', icon: <WalletIcon /> },
  { to: '/notifications', label: 'Inbox', icon: <BellIcon /> },
  { to: '/account', label: 'Account', icon: <UserIcon /> },
];

export function PassengerLayout() {
  const unread = useUnreadNotifications();
  return (
    <div className="min-h-screen bg-surface-alt">
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomTabs items={TABS.map((tab) => (tab.to === '/notifications' ? { ...tab, badge: unread } : tab))} />
    </div>
  );
}
