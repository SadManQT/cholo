import { Outlet } from 'react-router-dom';
import { BottomTabs } from '../components/layout/BottomTabs';
import { CarIcon, CoinIcon, ReceiptIcon, UserIcon } from '../components/layout/icons';

// doc 12 §3: driver bottom tabs — 🚗 Home · 💰 Earnings · 🧾 Trips · 👤 Account
const TABS = [
  { to: '/driver', label: 'Home', icon: <CarIcon />, end: true },
  { to: '/driver/earnings', label: 'Earnings', icon: <CoinIcon /> },
  { to: '/driver/trips', label: 'Trips', icon: <ReceiptIcon /> },
  { to: '/driver/account', label: 'Account', icon: <UserIcon /> },
];

export function DriverLayout() {
  return (
    <div className="min-h-screen bg-surface-alt">
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomTabs items={TABS} />
    </div>
  );
}
