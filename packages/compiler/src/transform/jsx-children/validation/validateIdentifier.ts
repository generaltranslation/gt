import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import {
  isInvalidIdentifier,
  isOtherIdentifier,
} from '../../../utils/constants/other/helpers';
import { OTHER_IDENTIFIERS_ENUM } from '../../../utils/constants/other/constants';
import { createErrorLocation } from '../../../utils/errors';

/**
 * Given an Identifier, stringifies it
 * @returns {string} - The stringified identifier
 */
export function validateIdentifier(
  identifier: t.Identifier,
  state: TransformState
): { errors: string[]; value?: string } {
  const errors: string[] = [];
  // First, we check if this identifier is being overridden
  const overridingVariable = state.scopeTracker.getVariable(identifier.name);
  if (overridingVariable) {
    errors.push(
      `Cannot construct JsxChildren with a variable. Got: ${identifier.name}. This variable is being overridden!` +
        createErrorLocation(identifier)
    );
    return { errors };
  }

  // Check that this is a valid special identifier (undefined, Nan, etc.)
  if (!isOtherIdentifier(identifier.name)) {
    errors.push(
      `Cannot construct JsxChildren with a variable. Got: ${identifier.name}.` +
        createErrorLocation(identifier)
    );
    return { errors };
  }

  // Check for invalid identifiers
  if (isInvalidIdentifier(identifier.name)) {
    errors.push(
      `Cannot construct JsxChildren with a variable. Got: ${identifier.name}. This variable is an invalid identifier!` +
        createErrorLocation(identifier)
    );
    return { errors };
  }

  // Resolve the string value
  let value: string | undefined;
  switch (identifier.name) {
    case OTHER_IDENTIFIERS_ENUM.NAN:
    case OTHER_IDENTIFIERS_ENUM.INFINITY:
      value = identifier.name;
      break;
    default:
      value = undefined;
      break;
  }

  return { errors, value };
}
