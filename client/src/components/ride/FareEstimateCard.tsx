import { Card } from '../ui';
import type { RideQuote, VehicleCategory } from '../../types/ride.types';
import { formatBDT } from '../../utils/format';

const CATEGORY_ICONS: Record<string, string> = {
  Bike: '🏍️',
  CNG: '🛺',
  Car: '🚗',
  'Car Premium': '✨',
};

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
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-alt text-xl" aria-hidden="true">
          {CATEGORY_ICONS[category.name] ?? '🚘'}
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
