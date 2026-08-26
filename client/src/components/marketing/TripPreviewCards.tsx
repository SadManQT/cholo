import { ScrollReveal } from './ScrollReveal';

// Illustrative product screenshots, not live data — same honesty bar as
// BookingPreviewCard. Reuses established app patterns rather than
// inventing new ones: initials-avatar fallback (ProfilePage), receipt rows
// (TripDetailPage's fare breakdown), the searching radar's motion-safe
// pulse convention for the "on trip" live dot.
export function TripPreviewCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <ScrollReveal>
        <div className="h-full rounded-2xl border border-border bg-surface p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-cholo-50 px-2.5 py-1 text-xs font-semibold text-cholo-700">Driver found</span>
            <span className="text-xs text-ink-500">Arriving in 3 min</span>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-alt p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cholo-700 text-base font-bold text-white">RI</div>
            <div className="min-w-0">
              <p className="font-semibold text-ink-900">Rafiq Islam</p>
              <p className="text-xs text-ink-500">★ 4.9 · DHA-12-3456</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="flex-1 rounded-lg bg-surface-alt py-2 text-center text-sm font-semibold text-ink-900">Message</span>
            <span className="flex-1 rounded-lg bg-cholo-50 py-2 text-center text-sm font-semibold text-cholo-700">Call</span>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <div className="h-full rounded-2xl border border-border bg-surface p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full bg-info-600/10 px-2.5 py-1 text-xs font-semibold text-info-600">
              <span className="h-1.5 w-1.5 rounded-full bg-info-600 motion-safe:animate-pulse" aria-hidden="true" />
              On trip
            </span>
            <span className="text-xs text-ink-500">ETA 14 min</span>
          </div>
          <div className="relative mt-4 h-28 overflow-hidden rounded-xl bg-surface-alt">
            <div className="absolute left-1/2 top-1/2 h-px w-[70%] -translate-x-1/2 -translate-y-1/2 bg-border" aria-hidden="true" />
            <div className="absolute left-[65%] top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-cholo-700 bg-surface text-sm shadow" aria-hidden="true">🚗</div>
            <div className="absolute right-[10%] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-marigold-500" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm text-ink-500">Heading to <span className="font-semibold text-ink-900">Banani Super Market</span></p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="h-full rounded-2xl border border-border bg-surface p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-dashed border-border pb-3">
            <span className="flex items-center gap-1 rounded-full bg-cholo-50 px-2.5 py-1 text-xs font-semibold text-cholo-700">✓ Completed</span>
            <span className="text-xs text-ink-500">10:42 AM</span>
          </div>
          <p className="mt-4 text-center text-sm text-ink-500">Total fare</p>
          <p className="text-center text-3xl font-bold tabular-nums text-ink-900">৳450</p>
          <div className="mt-4 space-y-1.5 border-t border-dashed border-border pt-3 text-sm">
            <div className="flex justify-between text-ink-500"><span>Base fare</span><span className="tabular-nums">৳80</span></div>
            <div className="flex justify-between text-ink-500"><span>Distance (8.2 km)</span><span className="tabular-nums">৳320</span></div>
            <div className="flex justify-between text-ink-500"><span>Time (24 min)</span><span className="tabular-nums">৳50</span></div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
