import { PACKAGE_NAME } from './constants';

/**
 * Invoked when a method that was designated for overriding is invoked by @generaltranslation/react-core.
 * This is an internal library error due to incorrect implementation of a wrapper library.
 * @param methodName
 * @returns Error object
 */
export function createInternalUsageError(methodName: string): Error {
  return new Error(
    `${PACKAGE_NAME}: The ${methodName} function was not overridden. This is likely the result of importing directly from "generaltranslation/react-core".`
  );
}
