import useGTContext from '../provider/GTContext';

/**
 * A React hook that retrieves the user's currently selected region from the `<GTProvider>` context.
 *
 * Returns the `region` value as a string (e.g., `"US"`, `"CA"`) or `undefined` if no region has been set.
 *
 * ⚠️ **Note:** This hook must be used within a `<GTProvider>` component.
 * If used outside, it will throw an error:
 * `"useRegion(): Unable to access user's region outside of a <GTProvider>"`.
 *
 * @returns {string | undefined} The currently active region code, or `undefined` if not set.
 *
 * @example
 * ```tsx
 * const region = useRegion();
 *
 * if (!region) {
 *   console.log("No region set yet");
 * } else {
 *   console.log(`Current region: ${region}`);
 * }
 * ```
 */
export default function useRegion(): string | undefined {
  return useGTContext(
    "useRegion(): Unable to access user's region outside of a <GTProvider>"
  ).region;
}
