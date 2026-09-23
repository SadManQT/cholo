import { Card } from '../ui';
import type { RideQuote, VehicleCategory } from '../../types/ride.types';
import { formatBDT } from '../../utils/format';

const svg = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-7 w-7', 'aria-hidden': true };

function BikeGlyph() {
  return <svg {...svg}><circle cx="7" cy="21" r="4.5" /><circle cx="25" cy="21" r="4.5" /><path d="M7 21h6l5-8h5l2 8M13 13h5M20 9h3" /></svg>;
}
function CngGlyph() {
  return <svg {...svg}><path d="M5 22V13c0-3 2-6 7-6h8c3 0 5 2 6 5l2 4v6H5Z" /><path d="M5 16h23M16 7v9" /><circle cx="10" cy="23" r="2.5" /><circle cx="23" cy="23" r="2.5" /></svg>;
}
function CarGlyph({ premium = false }: { premium?: boolean }) {
  return (
    <svg {...svg}>
      <path d="M4 20v-4l3-6c.6-1.2 1.6-2 3-2h12c1.4 0 2.4.8 3 2l3 6v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M4 16h24" /><circle cx="9.5" cy="21" r="2.5" /><circle cx="22.5" cy="21" r="2.5" />
      {premium && <path d="M16 3.5l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function CategoryGlyph({ name }: { name: string }) {
  if (name === 'Bike') return <BikeGlyph />;
  if (name === 'CNG') return <CngGlyph />;
  return <CarGlyph premium={name.toLowerCase().includes('premium')} />;
}

interface FareEstimateCardProps {
  category: VehicleCategory;
  quote: RideQuote;
  selected: boolean;
  onSelect: () => void;
}

export function FareEstimateCard({ category, quote, selected, onSelect }: FareEstimateCardProps) {
  return (
    <Card variant="interactive" selected={selected} onClick={onSelect} aria-pressed={selected} className="p-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${selected ? 'bg-cholo-700 text-white' : 'bg-surface-alt text-ink-900'}`}>
          <CategoryGlyph name={category.name} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-ink-900">{category.name}</p>
            <p className="font-bold tabular-nums text-ink-900">{formatBDT(quote.totalFare)}</p>
          </div>
          <p className="text-sm text-ink-500">
            {quote.durationMin} min · {quote.distanceKm.toFixed(1)} km
            {quote.surgeMultiplier > 1 && (
              <span className="ml-2 rounded-full bg-marigold-500/15 px-2 py-0.5 text-xs font-medium text-marigold-500">
                {quote.surgeMultiplier.toFixed(1)}× surge
              </span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
