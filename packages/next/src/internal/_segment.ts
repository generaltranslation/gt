import type { GtSegmentProps } from '../provider/GtSegment';

/**
 * A page that client code imports renders without the translations of its
 * seed.
 */
export function GtSegment({ children }: GtSegmentProps) {
  return children;
}
