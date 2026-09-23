import { Outlet, useNavigate } from 'react-router-dom';
import {
  BadgeCheckIcon, BanknoteIcon, BellIcon, FileIcon, GridIcon, LifebuoyIcon, ListIcon, MapIcon, ScaleIcon, SirenIcon, TagIcon, UsersIcon,
} from '../components/layout/icons';
import { Sidebar } from '../components/layout/Sidebar';
import type { SidebarSection } from '../components/layout/Sidebar';
import { toast } from '../components/ui';
import { useAuth } from '../context/auth';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadNotifications();

  const sections: SidebarSection[] = [
    { title: 'Overview', items: [
      { to: '/admin', label: 'Dashboard', icon: <GridIcon />, end: true },
      { to: '/admin/notifications', label: 'Notifications', icon: <BellIcon />, badge: unread },
    ] },
    { title: 'Drivers', items: [
      { to: '/admin/drivers', label: 'Driver approvals', icon: <BadgeCheckIcon /> },
      { to: '/admin/documents', label: 'Document review', icon: <FileIcon /> },
    ] },
    { title: 'Marketplace', items: [
      { to: '/admin/users', label: 'Users', icon: <UsersIcon /> },
      { to: '/admin/pricing', label: 'Pricing', icon: <TagIcon /> },
      { to: '/admin/zones', label: 'Zones', icon: <MapIcon /> },
      { to: '/admin/payouts', label: 'Withdrawals', icon: <BanknoteIcon /> },
    ] },
    { title: 'Trust & safety', items: [
      { to: '/admin/sos', label: 'SOS board', icon: <SirenIcon /> },
      { to: '/admin/disputes', label: 'Disputes', icon: <ScaleIcon /> },
      { to: '/admin/support', label: 'Support', icon: <LifebuoyIcon /> },
      { to: '/admin/audit', label: 'Audit log', icon: <ListIcon /> },
    ] },
  ];

  async function signOut() {
    try {
      await logout();
    } finally {
      toast.info('Signed out.');
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt md:flex">
      <Sidebar sections={sections} user={user} onSignOut={() => void signOut()} />
      <div className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </div>
    </div>
  );
}
