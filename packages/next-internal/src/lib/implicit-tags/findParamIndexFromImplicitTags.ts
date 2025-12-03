import { ImplicitTag } from './types';

/**
 * Given a list of implicit tags, returns the index of the parameter
 * @param implicitTags
 * @param param
 * @returns The index of the parameter (-1 if not found)
 * @example
 * ```ts
 * const implicitTags = ['_N_T_/[locale]/fr', '_N_T_/page/homepage'];
 * const index = findParamIndexFromImplicitTags(implicitTags, 'locale');
 * console.log(index); // 0
 * ```
 */
export function findParamIndexFromImplicitTags(
  implicitTags: ImplicitTag[],
  param: string
): number {
  const encodedParam = `[${param}]`;

  const encodedTag = implicitTags.find((tag) => tag.includes(encodedParam));
  if (!encodedTag) return -1;

  // include the _N_T_/ prefix in the index
  return encodedTag.split('/').indexOf(encodedParam);
}
