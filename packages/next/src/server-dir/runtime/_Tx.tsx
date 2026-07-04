import React from 'react';
import { TxProps } from '../../utils/types';
import { Tx as Core_Tx } from 'gt-react';
import { getRequestConditions } from '../../request/getRequestConditions';

/**
 * Runtime translation component that renders its children in the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <Tx>
 *  Hello, {name}!
 * </Tx>
 * ```
 *
 * @example
 * ```jsx
 * // With a context:
 * <Tx context="greeting">
 *  Hello, {name}!
 * </Tx>
 * ```
 *
 * @param {string} [context] - A context for the translation.
 * @param {string} [locale] - The locale to use for the translation.
 * @returns {Promise<React.ReactNode>} The translated content.
 */
export async function Tx({
  locale,
  ...props
}: TxProps): Promise<React.ReactNode> {
  const { _locale, _enableI18n } = await getRequestConditions();
  return (
    <Core_Tx {...props} _locale={locale || _locale} _enableI18n={_enableI18n} />
  );
}
/** @internal _gtt - The GT transformation for the component. */
Tx._gtt = 'translate-runtime';
