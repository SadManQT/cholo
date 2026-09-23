import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE_OUT } from '../../utils/motion';
import { CoinIcon, GlobeIcon, LocationPinIcon, RouteIcon, ShieldIcon, WalletIcon } from './FeatureIcons';

const FEATURE_ICONS = {
  location: LocationPinIcon,
  route: RouteIcon,
  wallet: WalletIcon,
  shield: ShieldIcon,
  globe: GlobeIcon,
  coin: CoinIcon,
} as const;

type FeatureIconKey = keyof typeof FEATURE_ICONS;

export interface TourFeature {
  icon: FeatureIconKey;
  title: string;
  body: string;
  accent: string;
}

interface FeatureTourProps {
  features: TourFeature[];
}

export function FeatureTour({ features }: FeatureTourProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sectionInView, setSectionInView] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setSectionInView(entry.isIntersecting), {
      rootMargin: '0px 0px -50% 0px',
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = blockRefs.current.indexOf(entry.target as HTMLDivElement);
          if (index !== -1) setActiveIndex(index);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    const currentBlocks = blockRefs.current;
    currentBlocks.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [features.length]);

  const active = features[activeIndex];
  const ActiveIcon = FEATURE_ICONS[active.icon];

  return (
    <div ref={sectionRef} className="relative">
      {sectionInView && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-gradient-to-br from-cholo-50 via-surface-alt to-cholo-50">
          {}
          <div className="absolute inset-0 hidden items-center justify-center pl-[38%] lg:flex">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'scale(0.92)' }}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                exit={{ opacity: 0, transform: reduceMotion ? 'none' : 'scale(0.92)' }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="flex flex-col items-center gap-4 px-6 text-center"
              >
                <span className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-xl ${active.accent}`}>
                  <ActiveIcon className="h-11 w-11" />
                </span>
                <span className="max-w-xs text-lg font-bold text-ink-900 sm:text-2xl">{active.title}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute inset-x-0 bottom-[12%] flex justify-center gap-2.5">
            {features.map((feature, index) => (
              <span
                key={feature.title}
                className={`h-2 w-2 rounded-full transition-[transform,background-color] duration-300 ease-cholo-out ${
                  index === activeIndex ? `${reduceMotion ? '' : 'scale-125'} bg-cholo-700` : 'bg-ink-900/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10">
        {features.map((feature, index) => {
          const Icon = FEATURE_ICONS[feature.icon];
          return (
            <div
              key={feature.title}
              ref={(el) => {
                blockRefs.current[index] = el;
              }}
              className="flex min-h-[65vh] items-center py-8 lg:min-h-[85vh]"
            >
              <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-lg">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${feature.accent}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-xl font-bold text-ink-900">{feature.title}</h3>
                <p className="mt-2 text-ink-500">{feature.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
