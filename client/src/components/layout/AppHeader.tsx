import { Link, NavLink } from 'react-router-dom';
import { CholoLogo } from '../brand/CholoLogo';
import { t } from '../../i18n';
import type { TabItem } from './BottomTabs';

interface AppHeaderProps {
  home: string;
  items: TabItem[];
  badge?: string;
}

export function AppHeader({ home, items, badge }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-[var(--app-header)] max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to={home} aria-label={t('Cholo home')} className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700">
          <CholoLogo className="h-10 md:h-12" />
          {badge && <span className="rounded-full bg-cholo-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cholo-700">{badge}</span>}
        </Link>
        <nav aria-label={t('Primary')} className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `relative flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${
                isActive ? 'bg-cholo-50 text-cholo-700' : 'text-ink-500 hover:bg-surface-alt hover:text-ink-900'
              }`}
            >
              <span className="relative [&>svg]:h-[18px] [&>svg]:w-[18px]">
                {item.icon}
                {item.badge ? (
                  <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-danger-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="cholo-gold-rule h-0.5 opacity-80" aria-hidden="true" />
    </header>
  );
}
