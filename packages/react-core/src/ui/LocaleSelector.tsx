import React from 'react';
import { LocaleSelectorProps } from './types';
import { createInternalUsageError } from '../errors-dir/internalErrors';

/**
 * @deprecated - this function is to always be overridden by a wrapper react package
 */
export default function LocaleSelector({}: LocaleSelectorProps): React.JSX.Element | null {
  throw createInternalUsageError('LocaleSelector');
}
