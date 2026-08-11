// Small hand-built icon set for nav chrome (bottom tabs, sidebar) — same
// stroke style as the ui/ kit's own icons (Input's eye toggle, EmptyState's
// default icon), no icon library dependency for a handful of glyphs.
type IconProps = { className?: string };

const base = 'h-5 w-5';

export function HomeIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReceiptIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

export function WalletIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 10h19M15.5 13.5h2.5" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CarIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 13l1.5-5a2 2 0 0 1 1.9-1.4h11.2A2 2 0 0 1 19.5 8l1.5 5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2.5" y="13" width="19" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="18.5" r="1.5" />
      <circle cx="17" cy="18.5" r="1.5" />
    </svg>
  );
}

export function CoinIcon({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.1-2 2.5-2s2.5.7 2.5 1.8c0 2.4-5 1.3-5 3.7 0 1.1 1.1 1.8 2.5 1.8s2.5-.6 2.5-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
