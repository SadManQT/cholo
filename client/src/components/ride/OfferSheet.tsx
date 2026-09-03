import { useEffect, useRef } from 'react';
import type { RideOffer } from '../../types/ride.types';
import { formatBDT, formatDistance } from '../../utils/format';
import { useCountdown } from '../../hooks/useCountdown';
import { BottomSheet, Button } from '../ui';

interface OfferSheetProps {
  offer: RideOffer | null;
  accepting: boolean;
  rejecting: boolean;
  onAccept: () => void;
  onReject: () => void;
  onExpired: () => void;
}

export function OfferSheet({ offer, accepting, rejecting, onAccept, onReject, onExpired }: OfferSheetProps) {
  const { remaining, start } = useCountdown();
  const startedFor = useRef<string | null>(null);
  const expiredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!offer) {
      startedFor.current = null;
      return;
    }
    // Guard on the id, not object identity: DriverHomePage polls
    // GET /driver/offers every 5s, so the same still-pending offer arrives
    // as a brand-new object each poll — without this guard the alert
    // (vibrate/beep) and countdown would restart every poll instead of once
    // per offer.
    if (startedFor.current === offer.id) return;
    startedFor.current = offer.id;
    expiredFor.current = null;
    start(Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));

    navigator.vibrate?.([140, 80, 140]);
    try {
      const AudioContextConstructor = window.AudioContext;
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.value = 0.04;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.addEventListener('ended', () => void context.close());
    } catch {
      // Autoplay policies may block audio before a user gesture; vibration
      // and the full-screen offer remain the non-audio fallbacks.
    }
  }, [offer, start]);

  useEffect(() => {
    if (!offer || startedFor.current !== offer.id || remaining > 0 || expiredFor.current === offer.id) return;
    expiredFor.current = offer.id;
    onExpired();
  }, [offer, onExpired, remaining]);

  if (!offer) return null;
  const percent = Math.max(0, Math.min(100, (remaining / 15) * 100));
  const urgent = remaining <= 5;

  return (
    <BottomSheet open snapPoint="half" onSnapPointChange={() => {}}>
      <div className="space-y-4 pb-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-semibold">
            <span className={urgent ? 'text-danger-600' : 'text-marigold-500'}>New ride</span>
            <span className={`tabular-nums ${urgent ? 'text-danger-600' : 'text-ink-900'}`}>0:{String(remaining).padStart(2, '0')}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full w-full origin-left transition-transform duration-1000 ease-linear ${urgent ? 'bg-danger-600' : 'bg-marigold-500'}`}
              style={{ transform: `scaleX(${percent / 100})` }}
            />
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-ink-500">{offer.categoryName}</p><p className="text-4xl font-bold tabular-nums">{formatBDT(offer.estFare)}</p></div>
          <p className="text-right text-sm text-ink-500">{formatDistance(offer.estDistanceKm)} trip<br />{offer.estDurationMin} min</p>
        </div>

        <div className="rounded-xl bg-surface-alt p-3 text-sm">
          <p><span className="font-semibold text-cholo-700">Pickup · {formatDistance(offer.driverDistanceKm)} away</span><br />{offer.pickupAddress ?? 'Pickup pin'}</p>
          <p className="mt-3"><span className="font-semibold text-danger-600">Dropoff</span><br />{offer.dropoffAddress ?? 'Dropoff pin'}</p>
          <p className="mt-3 border-t border-border pt-3">★ {offer.passengerRating} passenger</p>
        </div>

        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Button variant="secondary" loading={rejecting} disabled={accepting || remaining === 0} onClick={onReject}>Reject</Button>
          <Button loading={accepting} disabled={rejecting || remaining === 0} onClick={onAccept}>✓ Accept</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
