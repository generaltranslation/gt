import { ImplicitTag } from './types';

/**
 * Given a list of implicit tags, returns the parameter value from the request URL
 * @param implicitTags
 * @param index
 * @returns The parameter value from the request URL
 * @example
 * ```ts
 * const implicitTags = ['_N_T_/[locale]/homepage', '_N_T_/fr/homepage'];
 * const param = extractParamFromImplicitTags(implicitTags, 1);
 * console.log(param); // 'fr'
 * ```
 */
export function extractParamFromImplicitTags(
  implicitTags: ImplicitTag[],
  index: number
): string | undefined {
  // entry will be found likely at the last index, see: https://github.com/vercel/next.js/blob/a05f664bb41a07ec97cc4345edbeed7aa251ad46/packages/next/src/server/lib/implicit-tags.ts#L97
  const implicitTag = implicitTags[implicitTags.length - 1];
  const segments = implicitTag.split('/');
  if (segments.length <= index) return undefined;
  return segments[index];
}
