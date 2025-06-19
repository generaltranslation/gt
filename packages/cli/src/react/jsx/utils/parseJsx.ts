import { Updates } from '../../../types/index.js';

import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

import * as t from '@babel/types';
import addGTIdentifierToSyntaxTree from '../../data-_gt/addGTIdentifierToSyntaxTree.js';
import {
  warnHasUnwrappedExpressionSync,
  warnVariablePropSync,
  warnNestedTComponent,
} from '../../../console/index.js';
import { isAcceptedPluralForm, JsxChildren } from 'generaltranslation/internal';
import { handleChildrenWhitespace } from '../trimJsxStringChildren.js';
import { isStaticExpression } from '../evaluateJsx.js';
import { VARIABLE_COMPONENTS } from './constants.js';
import { Metadata } from 'generaltranslation/types';

/**
 * Builds a JSX tree from a given node, recursively handling children.
 * @param node - The node to build the tree from
 * @param unwrappedExpressions - An array to store unwrapped expressions
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param insideT - Whether the current node is inside a <T> component
 * @returns The built JSX tree
 */
export function buildJSXTree(
  importAliases: Record<string, string>,
  node: any,
  unwrappedExpressions: string[],
  updates: Updates,
  errors: string[],
  file: string,
  insideT: boolean
):
  | {
      expression?: boolean;
      result?: string;
      type?: string;
      props?: {
        children?: any;
      };
    }
  | string
  | null {
  if (t.isJSXExpressionContainer(node)) {
    // Skip JSX comments
    if (t.isJSXEmptyExpression(node.expression)) {
      return null;
    }

    const expr = node.expression;
    const staticAnalysis = isStaticExpression(expr);
    if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
      // Preserve the exact whitespace for static string expressions
      return {
        expression: true,
        result: staticAnalysis.value,
      };
    }
    // Keep existing behavior for non-static expressions
    const code = generate(node).code;
    unwrappedExpressions.push(code); // Keep track of unwrapped expressions for error reporting
    return code;
  } else if (t.isJSXText(node)) {
    // Updated JSX Text handling
    // JSX Text handling following React's rules
    const text = node.value;
    return text;
  } else if (t.isJSXElement(node)) {
    const element = node;
    const elementName = element.openingElement.name;

    let typeName;
    if (t.isJSXIdentifier(elementName)) {
      typeName = elementName.name;
    } else if (t.isJSXMemberExpression(elementName)) {
      typeName = generate(elementName).code;
    } else {
      typeName = null;
    }

    // Convert from alias to original name
    const componentType = importAliases[typeName ?? ''];

    if (componentType === 'T' && insideT) {
      // Add error: No nested <T> components are allowed
      errors.push(
        warnNestedTComponent(
          file,
          `${element.loc?.start?.line}:${element.loc?.start?.column}`
        )
      );
      return null;
    }

    // If this JSXElement is one of the recognized variable components,
    const elementIsVariable = VARIABLE_COMPONENTS.includes(componentType);

    const props: { [key: string]: any } = {};

    const elementIsPlural = componentType === 'Plural';
    const elementIsBranch = componentType === 'Branch';

    element.openingElement.attributes.forEach((attr) => {
      if (t.isJSXAttribute(attr)) {
        const attrName = attr.name.name;
        let attrValue = null;
        if (attr.value) {
          if (t.isStringLiteral(attr.value)) {
            attrValue = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            if (
              (elementIsPlural && isAcceptedPluralForm(attrName as string)) ||
              (elementIsBranch && attrName !== 'branch')
            ) {
              // Make sure that variable strings like {`I have ${count} book`} are invalid!
              if (
                t.isTemplateLiteral(attr.value.expression) &&
                !isStaticExpression(attr.value.expression).isStatic
              ) {
                unwrappedExpressions.push(generate(attr.value).code);
              }
            }
            attrValue = buildJSXTree(
              importAliases,
              attr.value.expression,
              unwrappedExpressions,
              updates,
              errors,
              file,
              true
            );
          }
        }
        props[attrName as any] = attrValue;
      }
    });

    if (elementIsVariable) {
      parseJSXElement(importAliases, element, updates, errors, file);
      return {
        // if componentType is undefined, use typeName
        // Basically, if componentType is not a GT component, use typeName such as <div>
        type: componentType ?? typeName,
        props,
      };
    }

    const children = element.children
      .map((child) =>
        buildJSXTree(
          importAliases,
          child,
          unwrappedExpressions,
          updates,
          errors,
          file,
          true
        )
      )
      .filter((child) => child !== null && child !== '');

    if (children.length === 1) {
      props.children = children[0];
    } else if (children.length > 1) {
      props.children = children;
    }

    return {
      // if componentType is undefined, use typeName
      // Basically, if componentType is not a GT component, use typeName such as <div>
      type: componentType ?? typeName,
      props,
    };
  }
  // If it's a JSX fragment
  else if (t.isJSXFragment(node)) {
    const children = node.children
      .map((child: any) =>
        buildJSXTree(
          importAliases,
          child,
          unwrappedExpressions,
          updates,
          errors,
          file,
          true
        )
      )
      .filter((child: any) => child !== null && child !== '');

    const props: { [key: string]: any } = {};

    if (children.length === 1) {
      props.children = children[0];
    } else if (children.length > 1) {
      props.children = children;
    }

    return {
      type: '',
      props,
    };
  }
  // If it's a string literal (standalone)
  else if (t.isStringLiteral(node)) {
    return node.value;
  }
  // If it's some other JS expression
  else if (
    t.isIdentifier(node) ||
    t.isMemberExpression(node) ||
    t.isCallExpression(node) ||
    t.isBinaryExpression(node) ||
    t.isLogicalExpression(node) ||
    t.isConditionalExpression(node)
  ) {
    return generate(node).code;
  } else {
    return generate(node).code;
  }
}
// end buildJSXTree

// Parses a JSX element and adds it to the updates array
export function parseJSXElement(
  importAliases: Record<string, string>,
  node: t.JSXElement,
  updates: Updates,
  errors: string[],
  file: string
) {
  const openingElement = node.openingElement;
  const name = openingElement.name;

  // Only proceed if it's <T> ...
  if (!(name.type === 'JSXIdentifier' && importAliases[name.name] === 'T')) {
    return;
  }
  const componentErrors: string[] = [];
  const metadata: Metadata = {};

  // We'll track this flag to know if any unwrapped {variable} is found in children
  const unwrappedExpressions: string[] = [];

  // Gather <T>'s props
  openingElement.attributes.forEach((attr) => {
    if (!t.isJSXAttribute(attr)) return;
    const attrName = attr.name.name;
    if (typeof attrName !== 'string') return;

    if (attr.value) {
      // If it's a plain string literal like id="hello"
      if (t.isStringLiteral(attr.value)) {
        metadata[attrName] = attr.value.value;
      }
      // If it's an expression container like id={"hello"}, id={someVar}, etc.
      else if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        const code = generate(expr).code;

        // Only check for static expressions on id and context props
        if (attrName === 'id' || attrName === 'context') {
          const staticAnalysis = isStaticExpression(expr);
          if (!staticAnalysis.isStatic) {
            componentErrors.push(
              warnVariablePropSync(
                file,
                attrName,
                code,
                `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
              )
            );
          }
          // Use the static value if available
          if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
            metadata[attrName] = staticAnalysis.value;
          } else {
            // Only store the code if we couldn't extract a static value
            metadata[attrName] = code;
          }
        } else {
          // For other attributes that aren't id or context
          metadata[attrName] = code;
        }
      }
    }
  });

  // Build the JSX tree for this component
  const treeResult = buildJSXTree(
    importAliases,
    node,
    unwrappedExpressions,
    updates,
    componentErrors,
    file,
    false
  );

  let jsxTree = undefined;
  if (treeResult && typeof treeResult === 'object') {
    jsxTree = treeResult.props?.children;
  } else {
    jsxTree = treeResult;
  }

  if (componentErrors.length > 0) {
    errors.push(...componentErrors);
    return;
  }

  // Handle whitespace in children
  const whitespaceHandledTree = handleChildrenWhitespace(jsxTree);

  // Add GT identifiers to the tree
  let minifiedTree = addGTIdentifierToSyntaxTree(whitespaceHandledTree);
  console.log('minifiedTree', JSON.stringify(minifiedTree, null, 2));
  minifiedTree =
    Array.isArray(minifiedTree) && minifiedTree.length === 1
      ? minifiedTree[0]
      : minifiedTree;

  const id = metadata.id;

  // If we found an unwrapped expression, skip
  if (unwrappedExpressions.length > 0) {
    errors.push(
      warnHasUnwrappedExpressionSync(
        file,
        unwrappedExpressions,
        id,
        `${node.loc?.start?.line}:${node.loc?.start?.column}`
      )
    );
    return;
  }

  // <T> is valid here
  updates.push({
    dataFormat: 'JSX',
    source: minifiedTree,
    metadata,
  });
}
