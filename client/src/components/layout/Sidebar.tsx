import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

// doc 12 §7/§9: admin is desktop-first ("sidebar visible") but stays
// "usable but secondary" on mobile — a horizontal scroller below md:,
// not a full drawer component (that's more UI than this milestone asked for).
export interface SidebarItem {
  to: string;
  label: string;
  icon?: ReactNode;
  end?: boolean;
}

function linkClasses({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700
          ${isActive ? 'bg-cholo-50 text-cholo-700' : 'text-ink-500 hover:bg-surface-alt hover:text-ink-900'}`;
}

export function Sidebar({ items }: { items: SidebarItem[] }) {
  return (
    <>
      <nav
        aria-label="Admin"
        className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:bg-surface md:p-3"
      >
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
      <nav
        aria-label="Admin"
        className="flex gap-1 overflow-x-auto border-b border-border bg-surface p-2 md:hidden"
      >
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
