import React from 'react';
import { TaggedElement, TaggedElementProps } from '../types-dir/types';
import { AuthFromEnvParams, AuthFromEnvReturn } from './types';
import { createInternalUsageError } from '../errors-dir/internalErrors';

export function isValidTaggedElement(target: unknown): target is TaggedElement {
  return React.isValidElement<TaggedElementProps>(target);
}

/**
 * @deprecated - this function is to always be overridden by a wrapper react package
 */
export function readAuthFromEnv({}: AuthFromEnvParams): AuthFromEnvReturn {
  throw createInternalUsageError('readAuthFromEnv');
}
