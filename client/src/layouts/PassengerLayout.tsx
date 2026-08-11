import { Outlet } from 'react-router-dom';
import { BottomTabs } from '../components/layout/BottomTabs';
import { HomeIcon, ReceiptIcon, UserIcon, WalletIcon } from '../components/layout/icons';

// doc 12 §3: passenger bottom tabs — 🏠 Book · 🧾 Trips · 👛 Wallet · 👤 Account
const TABS = [
  { to: '/', label: 'Book', icon: <HomeIcon />, end: true },
  { to: '/trips', label: 'Trips', icon: <ReceiptIcon /> },
  { to: '/wallet', label: 'Wallet', icon: <WalletIcon /> },
  { to: '/account', label: 'Account', icon: <UserIcon /> },
];

export function PassengerLayout() {
  return (
    <div className="min-h-screen bg-surface-alt">
      {/* pb-16: content clears the fixed BottomTabs (h-16) instead of hiding behind it */}
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomTabs items={TABS} />
    </div>
  );
}
