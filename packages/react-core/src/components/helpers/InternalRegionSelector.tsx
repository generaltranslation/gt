import React, { ReactNode } from 'react';
import type { RegionData } from '../../hooks/useInternalRegionSelector';

/**
 * A dropdown component that allows users to select a region.
 * @param {string | undefined} region - The currently selected region.
 * @param {string[]} regions - The ordered list of available region codes.
 * @param {Map<string, RegionData>} regionData - Map of region codes to their display data (name, emoji, locale).
 * @param {function} setRegion - Function to update the current region.
 * @param {React.ReactNode} [placeholder] - Optional placeholder node to display as the first option when no region is selected.
 * @returns {React.ReactElement | null} The rendered region dropdown component or null to prevent rendering.
 *
 * @internal
 */
export function InternalRegionSelector({
  region,
  regions,
  regionData,
  setRegion,
  placeholder,
  ...props
}: {
  region: string | undefined;
  regions: string[];
  regionData: Map<string, RegionData>;
  setRegion: (region: string) => void;
  placeholder?: ReactNode;
  [key: string]: any;
}): React.JSX.Element | null {
  // If no regions are returned, just render nothing or handle gracefully
  if (!regions || regions.length === 0 || !setRegion) {
    return null;
  }

  return (
    <select
      name='generaltranslation-region'
      aria-label='General Translation region selector'
      {...props}
      // Fallback to an empty string if no region is set
      value={region || ''}
      onChange={(e) => setRegion(e.target.value)}
    >
      {/* Optional placeholder for when no region is set */}
      {!region && (
        <option key='placeholder' value='' suppressHydrationWarning>
          {placeholder || ''}
        </option>
      )}

      {regions.map((r) => (
        <option key={r} value={r} suppressHydrationWarning>
          {regionData.get(r)?.name ?? r}
        </option>
      ))}
    </select>
  );
}
