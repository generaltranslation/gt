import path from 'node:path';

/**
 * A Next.js layout file by basename. One owner for the driver's layout pass
 * and the emit phase's segment-layout search (round-10 A6).
 */
export function isLayoutFile(file: string): boolean {
  const base = path.basename(file);
  return (
    base === 'layout.tsx' ||
    base === 'layout.ts' ||
    base === 'layout.jsx' ||
    base === 'layout.js'
  );
}

/**
 * A layout in the `[locale]` segment directory itself, never one nested
 * deeper. "Anywhere under [locale]" is a different predicate; keep it that way.
 */
export function isLocaleSegmentLayout(file: string): boolean {
  return isLayoutFile(file) && path.basename(path.dirname(file)) === '[locale]';
}
