import { ClockIcon, RouteIcon, UsersIcon } from './FeatureIcons';
import { ScrollReveal } from './ScrollReveal';

export interface UpcomingFeature {
  icon: 'clock' | 'route' | 'users';
  accent: string;
  title: string;
  body: string;
}

const ICONS = { clock: ClockIcon, route: RouteIcon, users: UsersIcon };

// Deliberately separate from FeatureTour: these aren't built yet, so they
// get a lighter static grid with an explicit "Coming soon" label — not the
// same scrollytelling treatment as the real, shipped features, which would
// blur the line between "this exists" and "this is on the roadmap".
export function UpcomingFeatures({ features }: { features: UpcomingFeature[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {features.map((feature, index) => {
        const Icon = ICONS[feature.icon];
        return (
          <ScrollReveal key={feature.title} delay={Math.min(index, 5) * 0.05}>
            <div className="h-full rounded-2xl border border-dashed border-border bg-surface/60 p-6">
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${feature.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-marigold-500/15 px-2.5 py-1 text-xs font-semibold text-marigold-500">Coming soon</span>
              </div>
              <h3 className="mt-4 font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{feature.body}</p>
            </div>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
