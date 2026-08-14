import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';

// doc 12 §7's full page table (the §3 nav diagram condenses a couple of
// these under shared labels — this uses the table's actual routes).
const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/drivers', label: 'Driver approvals' },
  { to: '/admin/documents', label: 'Document review' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/pricing', label: 'Pricing & surge' },
  { to: '/admin/zones', label: 'Zones' },
  { to: '/admin/payouts', label: 'Withdrawals' },
  { to: '/admin/disputes', label: 'Disputes & reports' },
  { to: '/admin/sos', label: 'SOS board' },
  { to: '/admin/audit', label: 'Audit log' },
  { to: '/admin/support', label: 'Support' },
];

// doc 12 §9: admin is desktop-first (sidebar + content), "usable but
// secondary" on mobile (Sidebar itself switches to a horizontal scroller).
export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-alt md:flex-row">
      <Sidebar items={ADMIN_NAV} />
      <div className="flex-1 p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}
