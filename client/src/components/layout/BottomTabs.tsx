import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { t } from '../../i18n';

export interface TabItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  badge?: number;
}

export function BottomTabs({ items }: { items: TabItem[] }) {
  return (
    <nav
      aria-label={t('Primary')}
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-surface"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cholo-700
             ${isActive ? 'text-cholo-700' : 'text-ink-500'}`
          }
        >
          <span className="relative">
            {item.icon}
            {item.badge ? (
              <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-danger-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
