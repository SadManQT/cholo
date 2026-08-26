// Small stroke-based icon set for the feature tour — replaces raw emoji
// with graphics that match the hero illustration's line-art language
// (currentColor stroke, so each one tints via the feature's accent color).
// 24x24 viewBox, 1.8 stroke weight, round caps/joins throughout.

type IconProps = { className?: string };

const BASE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function LocationPinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...BASE} d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle {...BASE} cx={12} cy={9} r={2.6} />
    </svg>
  );
}

export function RouteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...BASE} cx={5.5} cy={18.5} r={2} />
      <circle {...BASE} cx={18.5} cy={5.5} r={2} />
      <path {...BASE} d="M7.2 17.2C13 14 11 8 16.3 7" strokeDasharray="3 3" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect {...BASE} x={3} y={6} width={18} height={13} rx={2.5} />
      <path {...BASE} d="M3 9.5h18" />
      <circle cx={16.5} cy={14} r={1.4} fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...BASE} d="M12 3.5 5 6v6c0 4.5 3 7.6 7 8.5 4-.9 7-4 7-8.5V6l-7-2.5Z" />
      <path {...BASE} d="M9 12.2l2 2 4-4.2" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...BASE} cx={12} cy={12} r={8.5} />
      <path {...BASE} d="M3.5 12h17M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5Z" />
    </svg>
  );
}

export function CoinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...BASE} cx={12} cy={12} r={8.5} />
      <path {...BASE} d="M9.3 14.8c.5.8 1.4 1.3 2.5 1.3 1.7 0 3-1 3-2.4 0-3-5.6-1.4-5.6-4.3 0-1.4 1.3-2.4 3-2.4 1 0 2 .5 2.5 1.3M12 6.3v1.2m0 9v1.2" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...BASE} cx={12} cy={12} r={8.5} />
      <path {...BASE} d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...BASE} cx={9} cy={9} r={3} />
      <path {...BASE} d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path {...BASE} d="M15.5 6.2c1.3.3 2.3 1.5 2.3 2.9 0 1.4-.9 2.5-2.2 2.9M17.8 14.7c2 .6 3.3 2 3.9 4.3" />
    </svg>
  );
}

