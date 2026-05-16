import { TaggedElement, GTTag } from '../types/types';

export default function getGTTag(child: TaggedElement): GTTag | null {
  if (child && child.props && child.props['data-_gt']) {
    return child.props['data-_gt'];
  }
  return null;
}
