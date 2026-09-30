import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { RING_PATH, WORDMARK, WORD_CUTS, WORD_LETTERS, WORD_PIN_PATH, WORD_ROAD_DASH, WORD_ROUTE_PATH, WORD_WHEELS } from '../../components/brand/logoArtwork';
import { language, setLanguage, t } from '../../i18n';
import { createScene } from './home/featureScenes';
import type { SceneKey } from './home/featureScenes';
import './home/home.css';

interface Step {
  key: SceneKey;
  name: string;
  title: string;
  facts: Array<[string, string]>;
}

const WHAT = t('What happens:');
const HOW = t('How it works:');
const WHY = t('Why it matters:');

// Every step of one ride, in order, then what sits around the ride.
const STEPS: Step[] = [
  {
    key: 'book', name: t('Book'), title: t('Book'),
    facts: [
      [WHAT, t('Say or type where you’re going, in Bangla or English.')],
      [HOW, t('Cholo finds the place, draws the route and shows the fare for bike, CNG and car.')],
      [WHY, t('You know the price before you go.')],
    ],
  },
  {
    key: 'match', name: t('Match'), title: t('Match'),
    facts: [
      [WHAT, t('Your request goes out to drivers nearby.')],
      [HOW, t('Drivers within 5 km get the offer first, then up to 10 km. The first to accept gets the trip.')],
      [WHY, t('You watch a driver accept in real time.')],
    ],
  },
  {
    key: 'women', name: t('Women-only'), title: t('Women'),
    facts: [
      [WHAT, t('Choose a women-only ride and only women drivers get the offer.')],
      [HOW, t('Cholo filters the request by driver before a single offer is sent.')],
      [WHY, t('More women can ride, and drive, with confidence.')],
    ],
  },
  {
    key: 'arrive', name: t('Arrive'), title: t('Arrive'),
    facts: [
      [WHAT, t('Watch your driver come to you, live on the map.')],
      [HOW, t('A driver can only mark “arrived” within 300 m of your pickup.')],
      [WHY, t('No false “I’m here” messages.')],
    ],
  },
  {
    key: 'board', name: t('Board'), title: t('Board'),
    facts: [
      [WHAT, t('Your driver asks to start and you confirm you’re in the car.')],
      [HOW, t('The trip only starts when both of you agree. If your driver isn’t there, you say so.')],
      [WHY, t('No trip can start without you.')],
    ],
  },
  {
    key: 'ride', name: t('Ride'), title: t('Ride'),
    facts: [
      [WHAT, t('Share your trip and your family follows it live.')],
      [HOW, t('One tap sends an SOS with your location to the Cholo safety team.')],
      [WHY, t('Help is one tap away on every trip.')],
    ],
  },
  {
    key: 'detour', name: t('Detour'), title: t('Detour'),
    facts: [
      [WHAT, t('In heavy rain, Cholo steers you around waterlogged roads.')],
      [HOW, t('Streets where traffic slows to a crawl in the rain are marked as flooded.')],
      [WHY, t('Your ride keeps moving through the monsoon.')],
    ],
  },
  {
    key: 'pay', name: t('Pay'), title: t('Pay'),
    facts: [
      [WHAT, t('Arrive and pay the way you like.')],
      [HOW, t('Cash, your Cholo wallet, or online with bKash, Nagad or card through SSLCommerz.')],
      [WHY, t('Every taka is on your receipt.')],
    ],
  },
  {
    key: 'rate', name: t('Rate'), title: t('Rate'),
    facts: [
      [WHAT, t('You and your driver rate each other.')],
      [HOW, t('One to five stars, with an optional comment, right after the trip.')],
      [WHY, t('Good drivers stand out and problems get noticed.')],
    ],
  },
  {
    key: 'metro', name: t('Metro + ride'), title: t('Metro'),
    facts: [
      [WHAT, t('Mix a Cholo ride with Metro Rail in one trip.')],
      [HOW, t('A bike to the station, MRT Line 6 across town, then a short walk.')],
      [WHY, t('Beat rush hour across the city.')],
    ],
  },
  {
    key: 'twin', name: t('Digital twin'), title: t('Twin'),
    facts: [
      [WHAT, t('Every change is tried on a simulated Dhaka first.')],
      [HOW, t('Thousands of virtual riders and drivers use the real Cholo system.')],
      [WHY, t('What reaches you has already been tested at city scale.')],
    ],
  },
];

const PRELOAD_MS = 3000;
const SHADE_START = 0.52;
const WHEEL_THRESHOLD = 50;
const SWIPE_THRESHOLD = 50;

const easeInOutCubic = (value: number) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const stepNumber = (index: number) => String(index + 1).padStart(2, '0');

function retrigger(element: HTMLElement, className: string) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

export function HomePage() {
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const preloaderRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const countValueRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const goToRef = useRef<(target: number) => void>(() => {});

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const portal = portalRef.current!;
    const logo = logoRef.current!;
    const context = canvas.getContext('2d')!;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scenes = STEPS.map((step) => createScene(step.key));
    const count = scenes.length;
    const nextOf = (at: number) => (at + 1) % count;
    const timers: number[] = [];
    let disposed = false;
    let frame = 0;
    let current = 0;
    let portalIndex = 1;
    let busy = true;
    let transitionActive = false;
    let expansion = 0;
    let maskScale = 0;
    let rotX = 0;
    let rotY = 0;
    let targetX = 0;
    let targetY = 0;
    let width = innerWidth;
    let height = innerHeight;
    let radius = 90;
    let wheelTotal = 0;
    let lastWheel = 0;
    let quietUntil = 0;
    let touchStartY: number | null = null;
    const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
    const orbit = { ...pointer };

    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, ms)));
    const twoFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    function animateValue(setter: (value: number) => void, duration: number, ease = easeInOutCubic) {
      if (reduceMotion || duration <= 0) {
        setter(1);
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const step = (now: number) => {
          if (disposed) return resolve();
          const progress = Math.min(1, (now - start) / duration);
          setter(ease(progress));
          if (progress < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    function resize() {
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      width = innerWidth;
      height = innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      radius = parseFloat(getComputedStyle(portal).borderTopLeftRadius) || 90;
    }

    function drawShade() {
      const shade = context.createLinearGradient(0, height * SHADE_START, 0, height);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.88)');
      context.fillStyle = shade;
      context.fillRect(0, height * SHADE_START, width, height * (1 - SHADE_START));
    }

    function roundedRectPoints(rectWidth: number, rectHeight: number, cornerRadius: number) {
      const r = Math.min(cornerRadius, rectWidth / 2, rectHeight / 2);
      const halfW = rectWidth / 2;
      const halfH = rectHeight / 2;
      const corners: Array<[number, number, number, number]> = [
        [halfW - r, -halfH + r, -Math.PI / 2, 0],
        [halfW - r, halfH - r, 0, Math.PI / 2],
        [-halfW + r, halfH - r, Math.PI / 2, Math.PI],
        [-halfW + r, -halfH + r, Math.PI, Math.PI * 1.5],
      ];
      const points: Array<[number, number]> = [];
      for (const [cx, cy, from, to] of corners) {
        for (let step = 0; step <= 10; step += 1) {
          const angle = from + ((to - from) * step) / 10;
          points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
        }
      }
      return points;
    }

    function drawPortal(frameRect: DOMRect) {
      const rectCx = frameRect.left + frameRect.width / 2;
      const rectCy = frameRect.top + frameRect.height / 2;
      const e = expansion;
      const cx = rectCx + (width / 2 - rectCx) * e;
      const cy = rectCy + (height / 2 - rectCy) * e;
      const scale = e ? 1 : maskScale;
      const w = (frameRect.width + (width - frameRect.width) * e) * scale;
      const h = (frameRect.height + (height - frameRect.height) * e) * scale;
      if (w <= 1 || h <= 1) return;
      const ax = (rotX * (1 - e) * Math.PI) / 180;
      const ay = (rotY * (1 - e) * Math.PI) / 180;
      const outline = new Path2D();
      roundedRectPoints(w, h, radius * (1 - e) * scale).forEach(([x, y], pointIndex) => {
        const z = x * Math.sin(ay) - y * Math.sin(ax);
        const perspective = 850 / (850 + z);
        const screenX = cx + x * Math.cos(ay) * perspective;
        const screenY = cy + y * Math.cos(ax) * perspective;
        if (pointIndex === 0) outline.moveTo(screenX, screenY);
        else outline.lineTo(screenX, screenY);
      });
      outline.closePath();
      context.save();
      context.clip(outline);
      scenes[portalIndex].draw(context, width, height, e, { x: rectCx, y: rectCy, width: frameRect.width });
      if (transitionActive) drawShade();
      context.restore();
      // The window's edge, so the next map reads as a separate view over the current one.
      context.strokeStyle = `rgba(255,255,255,${0.5 * (1 - e)})`;
      context.lineWidth = 1.5;
      context.stroke(outline);
    }

    let last = performance.now();
    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(40, now - last);
      last = now;
      rotX += (targetX - rotX) * Math.min(1, dt * 0.009);
      rotY += (targetY - rotY) * Math.min(1, dt * 0.009);
      scenes[current].update(dt);
      scenes[portalIndex].update(dt);

      const frameRect = portal.getBoundingClientRect();
      const portalFrame = { x: frameRect.left + frameRect.width / 2, y: frameRect.top + frameRect.height / 2, width: frameRect.width };
      scenes[current].draw(context, width, height, 1, portalFrame);
      drawShade();
      drawPortal(frameRect);

      orbit.x += (pointer.x - orbit.x) * 0.2;
      orbit.y += (pointer.y - orbit.y) * 0.2;
      if (cursorRef.current) cursorRef.current.style.transform = `translate3d(${orbit.x}px, ${orbit.y}px, 0)`;
    }

    async function revealMask(duration = 1050) {
      retrigger(root, 'is-mask-revealing');
      maskScale = 0;
      await animateValue((value) => { maskScale = value; }, duration);
    }

    async function introduce() {
      const preloader = preloaderRef.current!;
      const route = routeRef.current!;
      await animateValue((progress) => {
        countValueRef.current!.textContent = String(Math.round(progress * 100));
        route.style.strokeDashoffset = String(1 - progress);
        preloader.style.opacity = String(1 - 0.5 * progress);
      }, PRELOAD_MS, (value) => value);
      if (disposed) return;

      countValueRef.current!.textContent = '100';
      route.style.strokeDashoffset = '0';
      countRef.current!.classList.add('is-leaving');
      logo.classList.add('is-arrived');
      await wait(reduceMotion ? 0 : 650);
      logo.classList.add('is-docked');
      preloader.style.transition = 'opacity 1.2s ease';
      preloader.style.opacity = '0';
      timers.push(window.setTimeout(() => { countRef.current!.hidden = true; }, 750));
      timers.push(window.setTimeout(() => logo.classList.add('is-settled'), 2000));

      await revealMask();
      if (disposed) return;
      root.classList.add('is-ready');
      await wait(850);
      retrigger(root, 'is-revealing');
      busy = false;
    }

    // Forward: the window grows until the next step fills the screen.
    // Backward: the current step shrinks back into the window, uncovering the one before it.
    async function goTo(target: number, forward: boolean) {
      if (busy || target === current) return;
      busy = true;
      targetX = 0;
      targetY = 0;
      root.classList.add('has-moved');
      try {
        root.classList.remove('is-revealing', 'is-mask-revealing');
        root.classList.add('is-transitioning');
        transitionActive = true;
        if (forward) {
          portalIndex = target;
          await animateValue((value) => { expansion = value; }, 1100);
          await wait(reduceMotion ? 0 : 150);
          current = target;
          setIndex(target);
          retrigger(root, 'is-switching');
          await twoFrames();
          expansion = 0;
          maskScale = 0;
          portalIndex = nextOf(current);
        } else {
          const leaving = current;
          portalIndex = leaving;
          expansion = 1;
          current = target;
          setIndex(target);
          retrigger(root, 'is-switching');
          await twoFrames();
          await animateValue((value) => { expansion = 1 - value; }, 1100);
          expansion = 0;
          maskScale = 1;
          if (portalIndex !== nextOf(current)) {
            portalIndex = nextOf(current);
            maskScale = 0;
          }
        }
        transitionActive = false;
        root.classList.remove('is-transitioning');
        timers.push(window.setTimeout(() => retrigger(root, 'is-revealing'), 100));
        if (maskScale < 1) await revealMask(750);
        else retrigger(root, 'is-mask-revealing');
      } catch {
        transitionActive = false;
        expansion = 0;
        maskScale = 1;
        portalIndex = nextOf(current);
        root.classList.remove('is-transitioning');
      } finally {
        busy = false;
        quietUntil = performance.now() + 250;
      }
    }
    goToRef.current = (target) => { void goTo(target, target > current); };
    const step = (direction: number) => { void goTo((current + direction + count) % count, direction > 0); };

    function onWheel(event: WheelEvent) {
      const now = performance.now();
      if (busy || now < quietUntil) {
        // Swallow trackpad momentum so one flick moves one step.
        wheelTotal = 0;
        quietUntil = Math.max(quietUntil, now + 120);
        return;
      }
      if (now - lastWheel > 250) wheelTotal = 0;
      lastWheel = now;
      wheelTotal += event.deltaY + event.deltaX;
      if (Math.abs(wheelTotal) < WHEEL_THRESHOLD) return;
      step(Math.sign(wheelTotal));
      wheelTotal = 0;
    }
    function onTouchStart(event: TouchEvent) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }
    function onTouchEnd(event: TouchEvent) {
      if (touchStartY === null) return;
      const moved = touchStartY - (event.changedTouches[0]?.clientY ?? touchStartY);
      touchStartY = null;
      if (Math.abs(moved) >= SWIPE_THRESHOLD) step(Math.sign(moved));
    }
    function onKeyDown(event: KeyboardEvent) {
      const onControl = event.target instanceof HTMLElement && event.target.closest('a, button');
      if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(event.key) || (event.key === ' ' && !onControl)) {
        event.preventDefault();
        step(1);
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        step(-1);
      }
    }
    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      cursorRef.current?.classList.add('is-visible');
      if (busy) return;
      targetY = (event.clientX / innerWidth - 0.5) * 37.4;
      targetX = (event.clientY / innerHeight - 0.5) * -33;
    }
    function onPointerLeave() {
      targetX = 0;
      targetY = 0;
      cursorRef.current?.classList.remove('is-visible');
    }

    resize();
    root.classList.add('has-cursor');
    addEventListener('resize', resize);
    addEventListener('pointermove', onPointerMove);
    addEventListener('wheel', onWheel, { passive: true });
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchend', onTouchEnd, { passive: true });
    addEventListener('keydown', onKeyDown);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    frame = requestAnimationFrame(loop);
    void introduce();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('wheel', onWheel);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchend', onTouchEnd);
      removeEventListener('keydown', onKeyDown);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  const step = STEPS[index];
  const nextIndex = (index + 1) % STEPS.length;
  const next = STEPS[nextIndex];
  // Condensed caps are not equally wide: W and M take about half again as much room.
  const titleLength = Math.max(3, [...step.title].reduce((sum, letter) => sum + (/[WM]/i.test(letter) ? 1.45 : /[I]/i.test(letter) ? 0.5 : 1), 0));
  const titleFit = {
    '--title-fit': `${116 / titleLength}vw`,
    '--title-fit-mobile': `${176 / titleLength}vw`,
  } as CSSProperties;

  return (
    <main ref={rootRef} className="home">
      <p className="sr-only">{t('Cholo: ride-sharing for Dhaka. Follow one ride from booking to rating.')}</p>
      <canvas ref={canvasRef} className="home-canvas" aria-hidden="true" />

      <div ref={preloaderRef} className="home-preloader" aria-hidden="true" />
      <Link ref={logoRef} to="/welcome" className="home-logo" aria-label={t('Cholo home')}>
        <svg viewBox={WORDMARK.viewBox} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="home-logo-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FDCB4B" />
              <stop offset=".55" stopColor="#F5A516" />
              <stop offset="1" stopColor="#E07B0C" />
            </linearGradient>
            <mask id="home-logo-cut" maskUnits="userSpaceOnUse" x="-200" y="-1000" width="2600" height="1200">
              <rect x="-200" y="-519" width="2600" height="700" fill="#fff" />
              <g fill="#000" dangerouslySetInnerHTML={{ __html: WORD_CUTS }} />
            </mask>
            <mask id="home-logo-road" maskUnits="userSpaceOnUse" x="-200" y="-1000" width="2600" height="1200">
              <rect x="-200" y="-1000" width="2600" height="1200" fill="#fff" />
              <path d={WORD_ROAD_DASH} stroke="#000" strokeWidth={20} strokeDasharray="70 55" />
            </mask>
          </defs>
          <g className="home-logo-letters" mask="url(#home-logo-cut)" fill="currentColor" dangerouslySetInnerHTML={{ __html: WORD_LETTERS }} />
          {WORD_WHEELS.map((wheel) => (
            <g key={wheel.cx}>
              <circle cx={wheel.cx} cy={wheel.cy} r={wheel.r} fill="none" stroke="currentColor" strokeWidth={wheel.tyre} />
              <path className="home-logo-spokes" style={{ transformOrigin: `${wheel.cx}px ${wheel.cy}px` }} d={wheel.spokes} stroke="currentColor" strokeWidth={wheel.spokeWidth} strokeLinecap="round" />
              <circle cx={wheel.cx} cy={wheel.cy} r={wheel.hub} fill="url(#home-logo-gold)" />
            </g>
          ))}
          <g mask="url(#home-logo-road)">
            <path ref={routeRef} className="home-logo-route" d={WORD_ROUTE_PATH} pathLength={1} fill="none" stroke="url(#home-logo-gold)" strokeWidth={112} strokeLinejoin="round" />
          </g>
          <path d={RING_PATH} fillRule="evenodd" fill="url(#home-logo-gold)" />
          <path className="home-logo-pin" d={WORD_PIN_PATH} fillRule="evenodd" fill="url(#home-logo-gold)" />
        </svg>
      </Link>
      <div ref={countRef} className="home-count" aria-hidden="true">
        <span ref={countValueRef}>0</span>
        <span className="percent">%</span>
      </div>

      <header className="home-header home-chrome">
        <nav className="home-nav" aria-label={t('Primary navigation')}>
          <Link className="is-secondary" to="/register?intent=driver">{t('Drive with Cholo')}</Link>
          <Link className="is-primary" to="/login">{t('Log in')}</Link>
        </nav>
        <button type="button" className="home-pill" lang={language === 'bn' ? 'en' : 'bn'} onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}>
          {language === 'bn' ? 'English' : 'বাংলা'}
        </button>
      </header>

      <nav className="home-rail home-chrome" aria-label={t('Ride steps')}>
        <span className="home-rail-count">{stepNumber(index)}<span>/{STEPS.length}</span></span>
        {STEPS.map((item, itemIndex) => (
          <button
            key={item.key}
            type="button"
            className={`home-rail-step${itemIndex === index ? ' is-active' : ''}`}
            aria-label={`${stepNumber(itemIndex)} ${item.name}`}
            aria-current={itemIndex === index ? 'step' : undefined}
            onClick={() => goToRef.current(itemIndex)}
          >
            <span className="home-rail-name">{item.name}</span>
          </button>
        ))}
      </nav>

      <section className="home-portal-wrap home-chrome" aria-label={t('Next step')}>
        <div className="home-portal-heading">
          <span>{t('Next:')}</span>
          <span>[{stepNumber(nextIndex)}]<strong>{next.name}</strong></span>
        </div>
        <div ref={portalRef} className="home-portal" aria-hidden="true" />
        <p className="home-hint" aria-hidden="true">
          <span className="for-mouse">{t('Scroll to continue')}</span>
          <span className="for-touch">{t('Swipe up to continue')}</span>
          <span className="home-hint-arrow" />
        </p>
      </section>

      <section className="home-content home-chrome" aria-live="polite" style={titleFit}>
        <h1>{step.title}</h1>
        <div className="home-facts">
          <dl>
            {step.facts.map(([term, detail]) => (
              <div key={term} className="home-fact">
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
          <Link to="/register" className="home-book">{t('Book a ride')}</Link>
        </div>
      </section>

      <div ref={cursorRef} className="home-cursor" aria-hidden="true">
        <span className="home-cursor-ring" />
        <span className="home-cursor-dot" />
      </div>
    </main>
  );
}
