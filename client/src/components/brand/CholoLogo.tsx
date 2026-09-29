import { useId } from 'react';
import { MARK, MARK_SIMPLE, WORDMARK } from './logoArtwork';

interface CholoLogoProps {
  variant?: 'wordmark' | 'mark';
  className?: string;
  label?: string;
}

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
