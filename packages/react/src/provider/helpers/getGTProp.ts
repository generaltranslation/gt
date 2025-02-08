import { ReactElement } from 'react';
import { TranslatedElement } from '../../types/types';

export default function getGTProp(
  child: ReactElement<any> | TranslatedElement
): { id: number; [key: string]: any } | null {
  if (child && child.props && child.props['data-_gt']) {
    return child.props['data-_gt'];
  }
  return null;
}
