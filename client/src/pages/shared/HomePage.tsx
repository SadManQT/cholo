import { Link } from 'react-router-dom';
import { BikeRiderIllustration } from '../../components/marketing/BikeRiderIllustration';
import { ScrollReveal } from '../../components/marketing/ScrollReveal';

// doc 12 §10: "real <button>" is the rule for actual buttons, but these are
// *navigations* (real hrefs, right-clickable, openable in a new tab) — a
// <button onClick={navigate(...)}> would be wrong here. Matches Button.tsx's
// own recipe (height/radius/weight/transition/press-feedback) so a styled
// <Link> reads identically, the same pattern ProfilePage's support link uses.
const CTA_BASE = 'inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-cholo-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2';
const CTA_PRIMARY = `${CTA_BASE} bg-cholo-700 text-white hover:bg-cholo-800`;
const CTA_SECONDARY = `${CTA_BASE} border border-border bg-surface text-ink-900 hover:bg-surface-alt`;
const CTA_ON_DARK = `${CTA_BASE} border border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-offset-cholo-700`;

const FEATURES: Array<{ icon: string; title: string; body: string }> = [
  { icon: '📍', title: 'Live tracking, start to finish', body: 'Watch your driver glide toward you on the map, in real time — no refreshing, no guessing.' },
  { icon: '🗺️', title: 'Routes that make sense', body: 'Road-accurate routing that stays on real Bangladesh roads — never a straight line through a building.' },
  { icon: '💵', title: 'Cash or wallet, your call', body: 'Pay however suits you, with a fare breakdown you can actually read before you ride.' },
  { icon: '🆘', title: 'Help, one tap away', body: 'A visible SOS button on every ride, with our safety team alerted the moment it’s pressed.' },
  { icon: '🌐', title: 'বাংলা ও English', body: 'Every screen works in Bangla or English — pick whichever feels like home.' },
  { icon: '💰', title: 'Earnings you can see', body: 'Drivers get a transparent per-trip breakdown and fast payouts to bKash or Nagad.' },
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
        <section className="grid items-center gap-10 py-10 md:py-16 lg:grid-cols-2">
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
          </div>

          <BikeRiderIllustration className="mx-auto h-64 w-full max-w-md sm:h-80" />
        </section>

        <section className="py-12 md:py-20">
          <ScrollReveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything you need for the ride</h2>
          </ScrollReveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <ScrollReveal key={feature.title} delay={Math.min(index, 5) * 0.05}>
                <div className="h-full rounded-2xl border border-border bg-surface p-6">
                  <span className="text-3xl" aria-hidden="true">{feature.icon}</span>
                  <h3 className="mt-3 font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{feature.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
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
