import { parseImplicitTags } from './parseImplicitTags';
import { ImplicitTag } from './types';

/**
 * Given a work unit store, returns the implicit tags
 */
export function extractImplicitTags(
  workUnitStore: any
): ImplicitTag[] | undefined {
  if (!workUnitStore.implicitTags) return;

  // extract the implicit tags
  const implicitTags = workUnitStore.implicitTags;
  if (Array.isArray(implicitTags)) return parseImplicitTags(implicitTags);
  if (!implicitTags || typeof implicitTags !== 'object') return;

  // extract the tags
  const tags = implicitTags.tags;
  if (!tags || !Array.isArray(tags)) return;
  return parseImplicitTags(tags);
}
