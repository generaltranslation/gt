import React from 'react';
import { TaggedElement, TranslatedContent } from '../types/types';
export declare function isTranslatedContent(
  target: unknown
): target is TranslatedContent;
export declare function isValidTaggedElement(
  target: unknown
): target is TaggedElement;
export declare function isEmptyReactFragment(
  target: unknown
): target is React.ReactElement;
export declare function getAuth(
  projectId?: string,
  devApiKey?: string
): {
  projectId?: string;
  devApiKey?: string;
};
//# sourceMappingURL=utils.d.ts.map
