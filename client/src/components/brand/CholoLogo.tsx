import { useId } from 'react';
import { MARK, MARK_SIMPLE, WORDMARK } from './logoArtwork';

interface CholoLogoProps {
  /** "wordmark": the full চলো lettering. "mark": the square app icon (চ on green). */
  variant?: 'wordmark' | 'mark';
  /** Size it with height (wordmark) or width/height (mark) classes, e.g. "h-10" or "h-9 w-9". */
  className?: string;
  /** Pass a label when the logo is the only content of a link; leave it off when text beside it says "Cholo". */
  label?: string;
}

// Vector artwork, so it stays sharp at any size and on high-density screens. The wordmark keeps its aspect ratio
// from the viewBox; small marks (under ~24px) switch to a simpler drawing without streaks so it still reads.
export function CholoLogo({ variant = 'wordmark', className = '', label }: CholoLogoProps) {
  const id = `cl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const art = variant === 'wordmark' ? WORDMARK : /\b(h|w)-(4|5|6)\b/.test(className) ? MARK_SIMPLE : MARK;
  return (
    <svg
      viewBox={art.viewBox}
      className={`${variant === 'wordmark' ? 'w-auto' : ''} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: art.inner.replaceAll('__ID__', id) }}
    />
  );
}
