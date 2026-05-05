import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import {
  BRANCH_CONTROL_PROPS,
  GT_COMPONENT_TYPES,
  PLURAL_FORMS,
} from '../../../utils/constants/gt/constants';

/**
 * Given an object expression path, get branch component argument paths.
 */
export function getBranchComponentParameters(
  parametersPath: NodePath<t.ObjectExpression>,
  canonicalName: string
): [string, NodePath<t.Expression>][] {
  // Get the args
  return parametersPath
    .get('properties')
    .map((propertyPath) => {
      // filter out non expression values
      if (!propertyPath.isObjectProperty()) {
        return null;
      }
      const property = propertyPath.node;

      const valuePath = propertyPath.get('value');
      if (!valuePath.isExpression()) {
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

      return [propertyName, valuePath as NodePath<t.Expression>];
    })
    .filter((arg) => arg !== null) as [string, NodePath<t.Expression>][];
}
