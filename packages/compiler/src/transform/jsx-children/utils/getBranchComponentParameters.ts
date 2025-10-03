import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../../utils/constants/gt/constants';
/**
 * Given object expression, get the branch component args
 */
export function getBranchComponentParameters(
  parameters: t.ObjectExpression,
  canonicalName: string
): [string, t.Expression][] {
  // Get the args
  const args = parameters.properties
    .map((property) => {
      // filter out non expression values
      if (!t.isObjectProperty(property)) {
        console.log('Not an object property', property);
        return null;
      }
      if (!t.isExpression(property.value)) {
        console.log('Not an expression', property.value);
        return null;
      }

      // get property name
      let propertyName: string;
      if (t.isStringLiteral(property.key)) {
        propertyName = property.key.value;
      } else if (t.isIdentifier(property.key)) {
        propertyName = property.key.name;
      } else {
        console.log('Not an identifier', property.key);
        return null;
      }

      // Avoid children property
      if (propertyName === 'children') {
        return null;
      }

      // Filter by branch component type
      if (
        canonicalName === GT_COMPONENT_TYPES.Branch &&
        propertyName === 'branch'
      ) {
        return null;
      } else if (
        canonicalName === GT_COMPONENT_TYPES.Plural &&
        propertyName === 'n'
      ) {
        return null;
      }

      return [propertyName, property.value];
    })
    .filter((arg) => arg !== null) as [string, t.Expression][];
  return args;
}
