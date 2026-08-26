import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { EASE_IN_OUT } from '../../utils/motion';

const REAR_WHEEL = { cx: 130, cy: 260 };
const FRONT_WHEEL = { cx: 370, cy: 260 };
const WHEEL_R = 50;
const BOTTOM_BRACKET = { x: 222, y: 260 };
const SEAT = { x: 172, y: 150 };
const HEAD_TUBE_TOP = { x: 330, y: 158 };

function Wheel({ cx, cy, spin }: { cx: number; cy: number; spin: boolean }) {
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 5;
    return { x2: cx + WHEEL_R * 0.85 * Math.cos(angle), y2: cy + WHEEL_R * 0.85 * Math.sin(angle) };
  });

  return (
    <g
      className={spin ? 'animate-spin' : undefined}
      style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: spin ? '1.4s' : undefined }}
    >
      <circle cx={cx} cy={cy} r={WHEEL_R} fill="none" stroke="#0B1F2E" strokeWidth={6} />
      {spokes.map((s, i) => (
        <line key={i} x1={cx} y1={cy} x2={s.x2} y2={s.y2} stroke="#0B1F2E" strokeWidth={3} strokeLinecap="round" />
      ))}
      <circle cx={cx} cy={cy} r={7} fill="#F5A623" />
    </g>
  );
}

// The hero's one hand-illustrated centerpiece — a flat-vector bike + rider
// (no image-generation tool is available in this environment, so this is
// hand-coded SVG rather than an AI-drawn picture; it has the benefit of
// letting individual parts animate independently, which a bitmap couldn't).
// Three motions, each gated by prefers-reduced-motion: wheels spin
// (Tailwind's animate-spin — already the app's own loading-spinner
// convention, linear per the animate skill's "constant motion" rule), a
// gentle idle bob, and a scroll-linked horizontal glide as the hero passes.
export function BikeRiderIllustration({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapperRef, offset: ['start end', 'end start'] });
  const glideX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-30, 90]);

  return (
    <div ref={wrapperRef} className={className}>
      {/* Plain <svg> root — CSS transforms on the outermost SVG element are
          poorly supported, so the scroll-glide lives on a nested <g>
          instead of here (a <motion.svg style={{x}}> emitted a broken
          transform attribute in testing). */}
      <svg viewBox="0 0 500 320" className="h-full w-full" role="img" aria-label="Illustration of a rider on a bike">
      <motion.g style={{ x: glideX }}>
        <ellipse cx={250} cy={296} rx={190} ry={12} fill="#0B1F2E" opacity={0.08} />

        <motion.g
          animate={{ y: reduceMotion ? 0 : [0, -6, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: EASE_IN_OUT }}
        >
          {/* frame */}
          <g fill="none" stroke="#0E7A5F" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
            <line x1={BOTTOM_BRACKET.x} y1={BOTTOM_BRACKET.y} x2={SEAT.x} y2={SEAT.y} />
            <line x1={BOTTOM_BRACKET.x} y1={BOTTOM_BRACKET.y} x2={HEAD_TUBE_TOP.x} y2={HEAD_TUBE_TOP.y} />
            <line x1={SEAT.x} y1={SEAT.y} x2={HEAD_TUBE_TOP.x} y2={HEAD_TUBE_TOP.y} />
            <line x1={BOTTOM_BRACKET.x} y1={BOTTOM_BRACKET.y} x2={REAR_WHEEL.cx} y2={REAR_WHEEL.cy} />
            <line x1={SEAT.x} y1={SEAT.y} x2={REAR_WHEEL.cx} y2={REAR_WHEEL.cy} />
            <line x1={HEAD_TUBE_TOP.x} y1={HEAD_TUBE_TOP.y} x2={FRONT_WHEEL.cx} y2={FRONT_WHEEL.cy} />
          </g>
          {/* seat + handlebar */}
          <g fill="none" stroke="#0B1F2E" strokeWidth={6} strokeLinecap="round">
            <line x1={SEAT.x - 14} y1={SEAT.y - 4} x2={SEAT.x + 10} y2={SEAT.y - 6} />
            <line x1={HEAD_TUBE_TOP.x} y1={HEAD_TUBE_TOP.y} x2={HEAD_TUBE_TOP.x + 18} y2={HEAD_TUBE_TOP.y - 28} />
            <line x1={HEAD_TUBE_TOP.x + 18} y1={HEAD_TUBE_TOP.y - 28} x2={HEAD_TUBE_TOP.x + 34} y2={HEAD_TUBE_TOP.y - 22} />
          </g>
          {/* pedal crank */}
          <circle cx={BOTTOM_BRACKET.x} cy={BOTTOM_BRACKET.y} r={8} fill="#0B1F2E" />

          <Wheel cx={REAR_WHEEL.cx} cy={REAR_WHEEL.cy} spin={!reduceMotion} />
          <Wheel cx={FRONT_WHEEL.cx} cy={FRONT_WHEEL.cy} spin={!reduceMotion} />

          {/* rider */}
          <g strokeLinecap="round">
            {/* torso: hip (near seat) leaning forward up to the shoulder */}
            <line x1={SEAT.x + 6} y1={SEAT.y - 4} x2={296} y2={108} stroke="#F5A623" strokeWidth={13} />
            {/* arm: shoulder to handlebar grip */}
            <line x1={296} y1={108} x2={360} y2={133} stroke="#0B1F2E" strokeWidth={7} />
            {/* leg: hip to pedal */}
            <line x1={SEAT.x + 10} y1={SEAT.y + 2} x2={BOTTOM_BRACKET.x} y2={BOTTOM_BRACKET.y - 2} stroke="#0B1F2E" strokeWidth={10} />
            {/* head + cap */}
            <circle cx={306} cy={85} r={17} fill="#0B1F2E" />
            <path d="M 291 78 A 17 17 0 0 1 321 78" fill="#F5A623" />
          </g>
        </motion.g>
      </motion.g>
      </svg>
    </div>
  );
}
