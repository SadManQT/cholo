import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookingPreviewCard } from '../../components/marketing/BookingPreviewCard';
import { FeatureTour } from '../../components/marketing/FeatureTour';
import type { TourFeature } from '../../components/marketing/FeatureTour';
import { ScrollReveal } from '../../components/marketing/ScrollReveal';
import { TripPreviewCards } from '../../components/marketing/TripPreviewCards';
import { UpcomingFeatures } from '../../components/marketing/UpcomingFeatures';
import type { UpcomingFeature } from '../../components/marketing/UpcomingFeatures';
import { EASE_IN_OUT } from '../../utils/motion';

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
    title: 'Watch it happen, live',
    body: "Your driver's exact position, updating in real time from the moment they accept — the same view they see. No refreshing, no guessing, no \"where are you?\" texts.",
  },
  {
    icon: 'route',
    accent: 'bg-cholo-700',
    title: 'Routes that actually make sense',
    body: "Real road-accurate routing, built for Bangladesh's streets — never a straight line through a building, a river, or across a border.",
  },
  {
    icon: 'wallet',
    accent: 'bg-marigold-500',
    title: 'Pay however works for you',
    body: 'Cash, wallet, bKash, or Nagad — your call. Every fare is broken down before you confirm, and every taka is logged, permanently, so nothing goes missing.',
  },
  {
    icon: 'shield',
    accent: 'bg-danger-600',
    title: 'Ride with total peace of mind',
    body: "Every driver is ID-verified before they can go online. One tap sends an SOS straight to our safety team, and you can request a women-only driver whenever you'd like.",
  },
  {
    icon: 'globe',
    accent: 'bg-ink-900',
    title: 'Speaks your language',
    body: 'বাংলা or English, your choice, everywhere — every screen, every notification, every receipt. Switch anytime, no settings hunt required.',
  },
  {
    icon: 'coin',
    accent: 'bg-cholo-800',
    title: 'Earn on your terms',
    body: 'See exactly what you make on every trip — gross, commission, net, no fine print — then cash out to bKash or Nagad whenever you need it.',
  },
];

// Real roadmap items, not shipped yet — kept visually distinct (see
// UpcomingFeatures) so the page never implies these already work.
const UPCOMING: UpcomingFeature[] = [
  {
    icon: 'clock',
    accent: 'bg-info-600',
    title: 'Book ahead',
    body: "Got a flight or an early meeting? Lock in your ride a day, or a week, in advance — no need to book the moment you walk out the door.",
  },
  {
    icon: 'users',
    accent: 'bg-marigold-500',
    title: 'Split the ride, split the fare',
    body: 'Heading the same way as someone else? Share the trip and the cost, automatically split down the middle.',
  },
  {
    icon: 'route',
    accent: 'bg-cholo-700',
    title: 'More than one stop',
    body: 'Need to grab something on the way, or drop a friend off first? Add extra stops to a single trip instead of booking twice.',
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

// A slow, continuous idle float — "delight" tier (animate skill §1: rare/
// first-time viewing, a marketing hero earns more than the restrained
// motion the rest of the app uses). Kept to opacity-safe transform only,
// and settles to a fixed pose rather than disappearing under reduced motion.
function FloatingCard({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={{ y: reduceMotion ? 0 : [0, -10, 0] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: EASE_IN_OUT }}
    >
      {children}
    </motion.div>
  );
}

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
        {/* The booking card is the one visual now — sticky alongside the
            left column on desktop (self-start, not the grid's default
            stretch/center, is what lets it hold position while the taller
            column scrolls past) so it's "seen throughout" this section
            instead of disappearing the moment you scroll past the
            headline. Gently floating, not static, but it settles — see
            FloatingCard below. */}
        <section className="relative grid gap-10 py-10 md:py-16 lg:grid-cols-2">
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

            <div className="mt-16 grid grid-cols-3 divide-x divide-border border-y border-border py-6">
              {FACTS.map((fact) => (
                <div key={fact.label} className="px-2 text-center">
                  <p className="text-2xl font-bold tabular-nums text-cholo-700 sm:text-3xl">{fact.value}</p>
                  <p className="mt-1 text-xs text-ink-500 sm:text-sm">{fact.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-16">
              <ScrollReveal>
                <h2 className="text-2xl font-bold sm:text-3xl">Your ride, at a glance</h2>
                <p className="mt-2 text-ink-500">A preview of the real screens — from match to receipt.</p>
              </ScrollReveal>
              <div className="mt-6">
                <TripPreviewCards layout="stack" />
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm lg:sticky lg:top-24 lg:mx-0 lg:ml-auto lg:self-start">
            <FloatingCard>
              <BookingPreviewCard />
            </FloatingCard>
          </div>
        </section>

        <section className="pt-12 md:pt-20">
          <ScrollReveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything you need for the ride</h2>
          </ScrollReveal>
        </section>
        <FeatureTour features={FEATURES} />

        <section className="py-12 md:py-20">
          <ScrollReveal>
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">What's coming next</h2>
              <p className="mt-2 text-ink-500">On the roadmap — not live yet, but on the way.</p>
            </div>
          </ScrollReveal>
          <UpcomingFeatures features={UPCOMING} />
        </section>

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
