import * as t from '@babel/types';
import {
  BRANCH_CONTROL_PROPS,
  GT_COMPONENT_TYPES,
  PLURAL_FORMS,
} from '../../../utils/constants/gt/constants';
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
        return null;
      }
      if (!t.isExpression(property.value)) {
        return null;
      }

      // get property name
      let propertyName: string;
      if (t.isStringLiteral(property.key)) {
        propertyName = property.key.value;
      } else if (t.isIdentifier(property.key)) {
        propertyName = property.key.name;
      } else {
        return null;
      }

      // Avoid children property
      if (propertyName === 'children') {
        return null;
      }

      // Filter out data-* attributes for Branch components
      if (
        canonicalName === GT_COMPONENT_TYPES.Branch &&
        propertyName.startsWith('data-')
      ) {
        return null;
      }

      // Filter by branch component type
      if (
        canonicalName === GT_COMPONENT_TYPES.Branch &&
        BRANCH_CONTROL_PROPS.has(propertyName)
      ) {
        return null;
      } else if (
        canonicalName === GT_COMPONENT_TYPES.Plural &&
        !PLURAL_FORMS.has(propertyName)
      ) {
        return null;
      }

      return [propertyName, property.value];
    })
    .filter((arg) => arg !== null) as [string, t.Expression][];
  return args;
}
