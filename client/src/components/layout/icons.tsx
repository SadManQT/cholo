import type React from 'react';
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

function Stroke({ className = base, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const BellIcon = (props: IconProps) => <Stroke {...props}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Stroke>;
export const GridIcon = (props: IconProps) => <Stroke {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Stroke>;
export const BadgeCheckIcon = (props: IconProps) => <Stroke {...props}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Stroke>;
export const FileIcon = (props: IconProps) => <Stroke {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Stroke>;
export const UsersIcon = (props: IconProps) => <Stroke {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-2.5-5.1" /></Stroke>;
export const TagIcon = (props: IconProps) => <Stroke {...props}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></Stroke>;
export const MapIcon = (props: IconProps) => <Stroke {...props}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></Stroke>;
export const BanknoteIcon = (props: IconProps) => <Stroke {...props}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></Stroke>;
export const ScaleIcon = (props: IconProps) => <Stroke {...props}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7ZM19 7l-3 7a3 3 0 0 0 6 0l-3-7Z" /></Stroke>;
export const SirenIcon = (props: IconProps) => <Stroke {...props}><path d="M7 18v-6a5 5 0 0 1 10 0v6" /><path d="M5 21h14v-3H5v3ZM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4" /></Stroke>;
export const ListIcon = (props: IconProps) => <Stroke {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Stroke>;
export const LifebuoyIcon = (props: IconProps) => <Stroke {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M14.8 9.2l3.6-3.6M5.6 18.4l3.6-3.6" /></Stroke>;
export const LogoutIcon = (props: IconProps) => <Stroke {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Stroke>;
export const PinIcon = (props: IconProps) => <Stroke {...props}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></Stroke>;
export const StarIcon = ({ className = base, filled = false }: IconProps & { filled?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  </svg>
);
export const GraduationIcon = (props: IconProps) => <Stroke {...props}><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6" /></Stroke>;
export const ClockIcon = (props: IconProps) => <Stroke {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Stroke>;
export const BoltIcon = (props: IconProps) => <Stroke {...props}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Stroke>;
export const FlagIcon = (props: IconProps) => <Stroke {...props}><path d="M4 21V4M4 4h12l-2 4 2 4H4" /></Stroke>;
export const ShieldIcon = (props: IconProps) => <Stroke {...props}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="M12 8v4M12 16h.01" /></Stroke>;
export const GiftIcon = (props: IconProps) => <Stroke {...props}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4ZM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4Z" /></Stroke>;
export const DownloadIcon = (props: IconProps) => <Stroke {...props}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Stroke>;
