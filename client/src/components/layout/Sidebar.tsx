import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LogoutIcon } from './icons';
import { t } from '../../i18n';

export interface SidebarItem {
  to: string;
  label: string;
  icon?: ReactNode;
  end?: boolean;
  badge?: number;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

function linkClasses({ isActive }: { isActive: boolean }) {
  return `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700
          ${isActive ? 'bg-cholo-50 text-cholo-800' : 'text-ink-500 hover:bg-surface-alt hover:text-ink-900'}`;
}

function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return <span className="ml-auto min-w-5 rounded-full bg-danger-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white">{count > 99 ? '99+' : count}</span>;
}

interface SidebarProps {
  sections: SidebarSection[];
  user: { fullName: string; phone: string } | null;
  onSignOut: () => void;
}

export function Sidebar({ sections, user, onSignOut }: SidebarProps) {
  const allItems = sections.flatMap((section) => section.items);
  return (
    <>
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface">
        <div className="flex items-center gap-2 px-5 pb-4 pt-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cholo-700 text-sm font-black text-white">{t('C')}</span>
          <div className="leading-tight">
            <p className="font-bold text-ink-900">{t('Cholo')}</p>
            <p className="text-xs text-ink-500">{t('Operations')}</p>
          </div>
        </div>
        <nav aria-label={t('Admin')} className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500/80">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
                    <span className="text-ink-500 group-[.bg-cholo-50]:text-cholo-700">{item.icon}</span>
                    {item.label}
                    <Badge count={item.badge} />
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        {user && (
          <div className="flex items-center gap-3 border-t border-border p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cholo-50 text-sm font-bold text-cholo-700">
              {user.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-ink-900">{user.fullName}</p>
              <p className="truncate text-xs text-ink-500">{user.phone}</p>
            </div>
            <button type="button" onClick={onSignOut} aria-label={t('Sign out')} title={t('Sign out')} className="rounded-lg p-2 text-ink-500 hover:bg-surface-alt hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700">
              <LogoutIcon />
            </button>
          </div>
        )}
      </aside>
      <div className="sticky top-0 z-20 border-b border-border bg-surface md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold text-ink-900">{t('Cholo')} <span className="font-normal text-ink-500">{t('Operations')}</span></span>
          <button type="button" onClick={onSignOut} className="text-sm font-medium text-ink-500 hover:text-danger-600">{t('Sign out')}</button>
        </div>
        <nav aria-label={t('Admin')} className="flex gap-1 overflow-x-auto px-2 pb-2">
          {allItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
              {item.icon}
              {item.label}
              <Badge count={item.badge} />
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
