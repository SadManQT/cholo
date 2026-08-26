import { Link } from 'react-router-dom';
import { BikeRiderIllustration } from '../../components/marketing/BikeRiderIllustration';
import { BookingPreviewCard } from '../../components/marketing/BookingPreviewCard';
import { FeatureTour } from '../../components/marketing/FeatureTour';
import type { TourFeature } from '../../components/marketing/FeatureTour';
import { ScrollReveal } from '../../components/marketing/ScrollReveal';
import { TripPreviewCards } from '../../components/marketing/TripPreviewCards';

// doc 12 §10: "real <button>" is the rule for actual buttons, but these are
// *navigations* (real hrefs, right-clickable, openable in a new tab) — a
// <button onClick={navigate(...)}> would be wrong here. Matches Button.tsx's
// own recipe (height/radius/weight/transition/press-feedback) so a styled
// <Link> reads identically, the same pattern ProfilePage's support link uses.
const CTA_BASE = 'inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-cholo-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2';
const CTA_PRIMARY = `${CTA_BASE} bg-cholo-700 text-white hover:bg-cholo-800`;
const CTA_SECONDARY = `${CTA_BASE} border border-border bg-surface text-ink-900 hover:bg-surface-alt`;
const CTA_ON_DARK = `${CTA_BASE} border border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-offset-cholo-700`;

const FEATURES: TourFeature[] = [
  {
    icon: 'location',
    accent: 'bg-info-600',
    title: 'Live tracking, start to finish',
    body: "Watch your driver's live position update on the map from the moment they accept — the exact same view your driver sees, so you're never left wondering where your ride actually is.",
  },
  {
    icon: 'route',
    accent: 'bg-cholo-700',
    title: 'Routes that make sense',
    body: 'Real, road-accurate routing that stays on actual Bangladesh roads and inside the border — never a straight line through a building, a river, or another country.',
  },
  {
    icon: 'wallet',
    accent: 'bg-marigold-500',
    title: 'Pay your way',
    body: 'Cash, wallet balance, bKash, or Nagad — whichever you prefer. Every fare shows its full breakdown before you confirm, and every taka is recorded to an append-only ledger.',
  },
  {
    icon: 'shield',
    accent: 'bg-danger-600',
    title: 'A ride you can trust',
    body: "Every driver's NID, license, and vehicle documents are reviewed and approved before they can go online. A one-tap SOS button on every ride alerts our safety team instantly, and you can request a women-only driver for extra peace of mind.",
  },
  {
    icon: 'globe',
    accent: 'bg-ink-900',
    title: 'বাংলা ও English',
    body: 'Every screen, every notification, every receipt — available in Bangla or English. Pick whichever feels like home, and switch anytime.',
  },
  {
    icon: 'coin',
    accent: 'bg-cholo-800',
    title: 'Earnings you can see',
    body: 'Drivers get a transparent breakdown on every single trip — gross fare, commission, net earning — plus fast payouts straight to bKash or Nagad, no waiting around.',
  },
];

// Feature-based, not fabricated usage numbers — this is a real
// in-development project, not a live service with a rides/revenue count
// to report, so a "5M+ rides completed" style stats strip would just be
// dishonest marketing copy. Everything here is true regardless of how
// many people have actually used it yet.
const FACTS: Array<{ value: string; label: string }> = [
  { value: '3', label: 'ride types — bike, CNG, car' },
  { value: '2', label: 'languages — বাংলা & English' },
  { value: '24/7', label: 'SOS safety monitoring' },
];

const STEPS: Array<{ title: string; body: string }> = [
  { title: 'Tell us where to', body: 'Set your pickup and destination — see your fare before you book.' },
  { title: 'Get matched', body: 'A nearby driver accepts your ride in seconds.' },
  { title: 'Track the ride', body: 'Watch your driver approach, live, on the map.' },
  { title: 'Arrive, pay, rate', body: 'Cash or wallet — then rate your trip.' },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-surface-alt text-ink-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <span className="text-xl font-bold text-cholo-700">Cholo</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-ink-900 hover:text-cholo-700">Log in</Link>
          <Link to="/register" className={`${CTA_PRIMARY} hidden h-10 px-4 text-sm sm:inline-flex`}>Sign up</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6">
        {/* The bike now rides as a faint background flourish rather than a
            foreground column — frees up the right column for something
            more convincing: a live-looking (if illustrative) booking
            preview, closer to what an actual visitor wants to see first. */}
        <section className="relative overflow-hidden py-10 md:py-16">
          <BikeRiderIllustration className="pointer-events-none absolute -right-16 top-1/2 hidden h-[26rem] w-[36rem] -translate-y-1/2 opacity-[0.14] lg:block" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
                Dhaka's ride,<br />done right.
              </h1>
              <p className="mt-4 max-w-md text-lg text-ink-500">
                Book a bike, CNG, or car in seconds. Track it live. Pay however you like.
                Cholo is Bangladesh-first, built for real roads and real riders.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className={CTA_PRIMARY}>Ride with Cholo</Link>
                <Link to="/register?intent=driver" className={CTA_SECONDARY}>Drive with Cholo</Link>
              </div>
              <BikeRiderIllustration className="mx-auto mt-10 h-48 w-full max-w-sm lg:hidden" />
            </div>

            <div className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
              <BookingPreviewCard />
            </div>
          </div>
        </section>

        <ScrollReveal className="border-y border-border py-8">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            {FACTS.map((fact) => (
              <div key={fact.label} className="px-2">
                <p className="text-2xl font-bold tabular-nums text-cholo-700 sm:text-3xl">{fact.value}</p>
                <p className="mt-1 text-xs text-ink-500 sm:text-sm">{fact.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <section className="py-12 md:py-20">
          <ScrollReveal>
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">Your ride, at a glance</h2>
              <p className="mt-2 text-ink-500">A preview of the real screens — from match to receipt.</p>
            </div>
          </ScrollReveal>
          <TripPreviewCards />
        </section>

        <section className="pt-12 md:pt-20">
          <ScrollReveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything you need for the ride</h2>
          </ScrollReveal>
        </section>
        <FeatureTour features={FEATURES} />

        <section className="py-12 md:py-20">
          <ScrollReveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          </ScrollReveal>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <ScrollReveal key={step.title} delay={Math.min(index, 5) * 0.05}>
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cholo-700 font-bold text-white">{index + 1}</div>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{step.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <ScrollReveal className="py-12 md:py-20">
          <div className="rounded-3xl bg-cholo-700 px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready when you are</h2>
            <p className="mx-auto mt-2 max-w-md text-white/85">
              Join as a rider or start earning as a driver — it takes less than two minutes.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-cholo-700 transition-[color,background-color,transform] duration-150 ease-cholo-out active:scale-[0.97] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cholo-700">
                Ride with Cholo
              </Link>
              <Link to="/register?intent=driver" className={CTA_ON_DARK}>Drive with Cholo</Link>
            </div>
          </div>
        </ScrollReveal>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-500">
        © {new Date().getFullYear()} Cholo. Built in Bangladesh.
      </footer>
    </div>
  );
}
