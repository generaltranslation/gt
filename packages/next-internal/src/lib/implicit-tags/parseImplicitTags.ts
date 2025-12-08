import { IMPLICIT_TAG_PREFIX, ImplicitTag } from './types';

/**
 * Given a list of tags, parse and validate them
 * @param tags
 * @returns The parsed tags
 */
export function parseImplicitTags(tags: any[]): ImplicitTag[] {
  return tags.filter(isImplicitTag);
}

// ===== HELPERS ===== //

function isImplicitTag(tag: unknown): tag is ImplicitTag {
  return typeof tag === 'string' && tag.startsWith(IMPLICIT_TAG_PREFIX);
}
