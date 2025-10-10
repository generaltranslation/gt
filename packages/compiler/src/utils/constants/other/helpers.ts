import {
  INVALID_IDENTIFIERS,
  InvalidIdentifier,
  OTHER_IDENTIFIERS,
  OtherIdentifier,
} from './constants';

/**
 * Checks if the string is an other identifier
 */
export function isOtherIdentifier(name: string): name is OtherIdentifier {
  return OTHER_IDENTIFIERS.includes(name as OtherIdentifier);
}

/**
 * Checks if the string is an invalid identifier
 */
export function isInvalidIdentifier(name: string): name is InvalidIdentifier {
  return INVALID_IDENTIFIERS.includes(name as InvalidIdentifier);
}
