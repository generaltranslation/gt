import useGTContext from '../provider/GTContext';

/**
 * Retrieves the version ID from the `<GTProvider>` context.
 *
 * @returns {string | undefined} The version ID for the current source, if set.
 *
 * @example
 * const versionId = useVersionId();
 * console.log(versionId); // 'abc123'
 */
export default function useVersionId(): string | undefined {
  return useGTContext(
    'useVersionId(): Unable to access version ID outside of a <GTProvider>'
  )._versionId;
}
