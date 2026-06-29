import { TaggedElement, GTTag } from '../types';

export function getGTTag(child: TaggedElement): GTTag | null {
  if (child && child.props && child.props['data-_gt']) {
    return child.props['data-_gt'];
  }
  return null;
}
