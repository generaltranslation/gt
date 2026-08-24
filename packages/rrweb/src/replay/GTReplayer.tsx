'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

import { createGTReplayer } from './player';
import type { GTReplayerBundle, GTReplayerOptions } from './player';

export type GTReplayerProps = GTReplayerOptions & {
  /** The recording to play (rrweb events + per-locale overlay). */
  bundle: GTReplayerBundle;
  className?: string;
  style?: CSSProperties;
};

/**
 * React wrapper around {@link createGTReplayer}: mounts the player into a container
 * div and tears it down on unmount (or when `bundle` / `initialLocale` change). The
 * container fills its parent by default, so size the parent (or pass `style`).
 */
export function GTReplayer({
  bundle,
  initialLocale,
  switchLocalesAllowed,
  debug,
  className,
  style,
}: GTReplayerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const handle = createGTReplayer(container, bundle, {
      initialLocale,
      switchLocalesAllowed,
      debug,
    });
    return () => handle.destroy();
  }, [bundle, initialLocale, switchLocalesAllowed, debug]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
