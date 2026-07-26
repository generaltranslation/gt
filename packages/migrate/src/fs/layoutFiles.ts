import path from 'node:path';

/**
 * A Next.js layout file by basename. One owner (round-10 arch finding A6):
 * the driver's layout-pass selection and the emit phase's segment-layout
 * search carried byte-identical private copies held together by a "must
 * agree" comment.
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
 * A layout sitting DIRECTLY in a `[locale]` segment directory
 * (…/[locale]/layout.tsx), never a deeper layout nested under it. The
 * subtree question ("is this file anywhere under [locale]") is a different
 * predicate; do not widen this one to answer it.
 */
export function isLocaleSegmentLayout(file: string): boolean {
  return isLayoutFile(file) && path.basename(path.dirname(file)) === '[locale]';
}
