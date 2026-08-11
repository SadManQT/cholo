import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

// doc 12 §3: passenger/driver bottom tabs, written once (doc 11 §8:
// "navbars are written once, not per page") and reused by both role layouts.
export interface TabItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** NavLink's `end` — true for the tab whose path is a prefix of others (e.g. "/driver"). */
  end?: boolean;
}

export function BottomTabs({ items }: { items: TabItem[] }) {
  return (
    <nav
      aria-label="Primary"
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
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
