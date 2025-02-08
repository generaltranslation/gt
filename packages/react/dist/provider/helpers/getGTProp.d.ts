import { ReactElement } from 'react';
import { TranslatedElement } from '../../types/types';
export default function getGTProp(
  child: ReactElement<any> | TranslatedElement
): {
  id: number;
  [key: string]: any;
} | null;
//# sourceMappingURL=getGTProp.d.ts.map
