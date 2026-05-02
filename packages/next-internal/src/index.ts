import { getWorkUnitStore } from './lib/getWorkUnitStore';
import { extractImplicitTags } from './lib/implicit-tags/extractImplicitTags';
import { extractParamFromImplicitTags } from './lib/implicit-tags/extractParamFromImplicitTags';
import { findParamIndexFromImplicitTags } from './lib/implicit-tags/findParamIndexFromImplicitTags';

/**
 * Given a parameter name, returns the parameter value from the request URL
 * @param param the name of the parameter to get
 * @param index the index of the parameter to get, if not provided, it will be inferred from the implicit tags (0 is the request url)
 * @returns The parameter value from the request URL
 *
 * @example
 * ```ts
 * // Path:    google.com/[locale]/homepage
 * // Request: google.com/fr/homepage
 * const locale = getRootParam('locale');
 * console.log(locale); // 'fr'
 * ```
 *
 * @example
 * ```ts
 * // Path:    google.com/[locale]/[region]/homepage
 * // Request: google.com/en/US/homepage
 * const region = getRootParam('region', 2);
 * console.log(region); // 'US'
 * const badRegion = getRootParam('region', 3);
 * console.log(badRegion); // 'homepage'
 * ```
 */
export function getRootParam(
  param: string,
  index: number = 0
): string | undefined {
  const workUnitStore = getWorkUnitStore();
  if (!workUnitStore) {
    return undefined;
  }

  const implicitTags = extractImplicitTags(workUnitStore);
  if (!implicitTags || !implicitTags.length) {
    return undefined;
  }

  index ||= findParamIndexFromImplicitTags(implicitTags, param);
  if (index === -1) {
    return undefined;
  }

  return extractParamFromImplicitTags(implicitTags, index);
}
