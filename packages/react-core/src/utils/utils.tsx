import React from 'react';
import { TaggedElement, TaggedElementProps } from './types';

export function isValidTaggedElement(target: unknown): target is TaggedElement {
  return React.isValidElement<TaggedElementProps>(target);
}
