import {
  GTProp,
  HTML_CONTENT_PROPS,
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
  VariableType,
} from 'generaltranslation/types';
import * as t from '@babel/types';
import { hashSource } from 'generaltranslation/id';
import {
  isTranslationComponent as isTranslationComponentName,
  isVariableComponent as isVariableComponentName,
  isBranchComponent as isBranchComponentName,
} from '../constants/gt/helpers';
import { getAttr } from '../jsx/getAttr';
import { GT_COMPONENT_TYPES } from '../constants/gt/constants';
import { JSXElementWithCanonicalId } from '../../transform/jsx-annotation/types';
import { getTag } from '../jsx/getTag';

/* =============================== */
/* Helper Functions */
/* =============================== */

/**
 * Object to keep track of the current index for GT IDs
 */
class IndexObject {
  index: number;
  constructor(index: number = 1) {
    this.index = index;
  }
  increment() {
    this.index += 1;
  }
  get() {
    return this.index;
  }
  copy() {
    return new IndexObject(this.index);
  }
}

/**
 * Creates an error with line number and file information
 */
function createError(message: string, node?: t.Node): Error {
  let errorMessage = `[GT_PLUGIN] ${message}`;

  if (node && node.loc) {
    errorMessage += ` (at line ${node.loc.start.line}, column ${node.loc.start.column + 1})`;
  }

  errorMessage += ` in ${__filename}`;

  return new Error(errorMessage);
}

/**
 * Reads a component's annotation to determine the component type
 */
function getComponentType(source: t.JSXElement): GT_COMPONENT_TYPES | null {
  return (source as JSXElementWithCanonicalId)._gt_canonical_identifier || null;
}

/**
 * Minifies canonical names
 */
const MINIFY_CANONICAL_NAME_MAP = {
  [GT_COMPONENT_TYPES.Var]: 'v',
  [GT_COMPONENT_TYPES.Num]: 'n',
  [GT_COMPONENT_TYPES.Currency]: 'c',
  [GT_COMPONENT_TYPES.DateTime]: 'd',
  [GT_COMPONENT_TYPES.Branch]: 'b',
  [GT_COMPONENT_TYPES.Plural]: 'p',
} as const;
function minifyCanonicalName(canonicalName: GT_COMPONENT_TYPES): string {
  return (
    MINIFY_CANONICAL_NAME_MAP[
      canonicalName as keyof typeof MINIFY_CANONICAL_NAME_MAP
    ] || canonicalName
  );
}

const defaultVariableNames = {
  [GT_COMPONENT_TYPES.Var]: 'value',
  [GT_COMPONENT_TYPES.Num]: 'n',
  [GT_COMPONENT_TYPES.DateTime]: 'date',
  [GT_COMPONENT_TYPES.Currency]: 'cost',
} as const;
const baseVariablePrefix = '_gt_';

function getVariableName(
  variableType: keyof typeof defaultVariableNames,
  id: number,
  name?: string
): string {
  if (name) return name;
  const baseVariableName = defaultVariableNames[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${id}`;
}

/* =============================== */
/* Base Cases */
/* =============================== */

/**
 * Handles Jsx text and whitespace
 * @param text - The text to handle
 * @returns The text value
 */
function handleJsxText(text: t.JSXText): string {
  // TODO: a lot of work here handling whitespace
  return text.value;
}

/**
 * Handles expressions (only constant strings and template literals)
 * @param expression - The expression to handle
 * @returns The expression value
 */
function handleExpression(expression: t.Expression): string {
  if (t.isStringLiteral(expression)) {
    return expression.value;
  }

  if (t.isTemplateLiteral(expression)) {
    if (expression.expressions.length > 0) {
      throw createError(
        'Encountered a template literal with expressions inside of a translation component: <T>{`${expression}`}</T>',
        expression
      );
    }
    return expression.quasis[0].value.cooked || '';
  }

  throw createError(
    'Encountered an expression inside of a translation component: <T>{expression}</T>',
    expression
  );
}

/**
 * Handles Jsx expression containers
 * @param expression - The expression to handle
 * @returns The expression value
 */
function handleJsxExpressionContainer(
  expression: t.JSXExpressionContainer
): string {
  if (t.isJSXEmptyExpression(expression.expression)) {
    throw createError(
      'Encountered an empty expression inside of a translation component: <T>{}</T>',
      expression
    );
  }
  return handleExpression(expression.expression);
}

/**
 * Handles Jsx spread child
 * @param expression - The expression to handle
 * @returns The expression value
 */
function handleJsxSpreadChild(expression: t.JSXSpreadChild): string {
  throw createError(
    'Encountered a spread child inside of a translation component: <T>{...expression}</T>',
    expression
  );
}

/**
 * Create a GT prop data
 * @param element - The element to create a GT prop data for
 * @param index - The index of the element
 * @returns The GT prop data
 */
function createGTPropData(element: t.JSXElement | t.JSXFragment): GTProp {
  const result: GTProp = {};
  if (t.isJSXFragment(element)) {
    return result;
  }
  // Get each of the html content props
  for (const [key, attr] of Object.entries(HTML_CONTENT_PROPS)) {
    const value = getAttr(element, attr);
    if (value) {
      result[key as keyof typeof HTML_CONTENT_PROPS] = value;
    }
  }
  return result;
}

/* =============================== */
/* Classification Functions */
/* =============================== */

/**
 * Check if a component is a specific type
 * @param component - The component to check
 * @param checkFunction - The function to check the component type
 * @returns True if the component is a specific type
 */
function _checkComponentType(
  component: t.JSXElement | t.JSXFragment,
  checkFunction: (string: string) => boolean
): boolean {
  const canonicalName = (component as JSXElementWithCanonicalId)
    ._gt_canonical_identifier;
  if (!canonicalName || !checkFunction(canonicalName)) {
    return false;
  }
  return true;
}

/**
 * Check if a component is a variable component
 * @param component - The component to check
 * @returns True if the component is a variable component
 */
function isVariableComponent(component: t.JSXElement | t.JSXFragment): boolean {
  return _checkComponentType(component, isVariableComponentName);
}

/**
 * Check if a component is a branch component
 * @param component - The component to check
 * @returns True if the component is a branch component
 */
function isBranchComponent(component: t.JSXElement | t.JSXFragment): boolean {
  return _checkComponentType(component, isBranchComponentName);
}

/**
 * Check if a component is a plural component
 * @param component - The component to check
 * @returns True if the component is a plural component
 */
function isPluralComponent(component: t.JSXElement | t.JSXFragment): boolean {
  return _checkComponentType(
    component,
    (name) => name === GT_COMPONENT_TYPES.Plural
  );
}

/**
 * Check if a component is a translation component
 * @param component - The component to check
 * @returns True if the component is a translation component
 */
function isTranslationComponent(
  component: t.JSXElement | t.JSXFragment
): boolean {
  return _checkComponentType(component, isTranslationComponentName);
}

/* =============================== */
/* Recursive Functions */
/* =============================== */

/**
 * Create a branch GT prop data
 * @param element - The element to create a branch GT prop data for
 * @param index - The index of the element
 * @returns The branch GT prop data
 */
function createBranchGTPropData(
  element: t.JSXElement | t.JSXFragment,
  index: IndexObject
): GTProp {
  if (t.isJSXFragment(element)) {
    return {};
  }
  const result: GTProp = createGTPropData(element);
  if (isPluralComponent(element)) {
    result.t = 'p';
  } else {
    result.t = 'b';
  }

  // Children
  const branches = Object.fromEntries(
    element.openingElement.attributes.map((attr) => {
      let name = null;
      let value = null;

      // Parse name
      if (t.isJSXAttribute(attr)) {
        name = attr.name.name;
      } else {
        throw createError(
          'Encountered a spread attribute inside of a branch component: <Branch attr={...spread}/>',
          attr
        );
      }

      // Parse value
      if (t.isStringLiteral(attr.value)) {
        value = attr.value.value;
      } else if (!attr.value) {
        value = null;
      } else {
        value = createJsxChild(attr.value, index);
      }

      return [name, value];
    })
  );
  result.b = branches;

  return result;
}

/**
 * Creates a GT prop
 * @param element - The element to create a GT prop for
 * @param index - The index of the element
 * @returns The GT prop
 */
function createGTProp(
  element: t.JSXElement | t.JSXFragment,
  index: IndexObject
): GTProp {
  if (isBranchComponent(element)) {
    return createBranchGTPropData(element, index.copy());
  }
  return createGTPropData(element);
}

/**
 * Create jsx variable
 */
function createVariable(variable: t.JSXElement, index: IndexObject): Variable {
  const canonicalName = (variable as JSXElementWithCanonicalId)
    ._gt_canonical_identifier;
  if (!canonicalName) {
    throw createError(
      'Variable component is missing annotation for canonical name',
      variable
    );
  }
  const name = getAttr(variable, 'name');
  return {
    i: index.get(),
    k: getVariableName(
      canonicalName as keyof typeof defaultVariableNames,
      index.get(),
      name || undefined
    ),
    v: minifyCanonicalName(canonicalName) as VariableType,
  };
}

/**
 * Create jsx element
 */
function createJsxElement(
  element: t.JSXElement | t.JSXFragment,
  index: IndexObject
): JsxElement {
  // Increment index
  index.increment();

  // Get element tag
  const tag = getTag(element);

  // Get GT data
  const gtData = createGTProp(element, index);

  // Get children
  const children = createJsxChildren(element.children, index);

  // Initialize result
  const result: JsxElement = {
    t: tag,
    i: index.get(),
    d: gtData,
    c: children,
  };

  // Return result
  return result;
}

/**
 * Create jsx child
 */
function createJsxChild(
  child: t.JSXElement['children'][number],
  index: IndexObject
): JsxChild {
  // handle text
  if (t.isJSXText(child)) {
    return handleJsxText(child);
  }

  // handle expression containers (rejects - unless is str literal)
  if (t.isJSXExpressionContainer(child)) {
    return handleJsxExpressionContainer(child);
  }

  // handle spread child (rejects)
  if (t.isJSXSpreadChild(child)) {
    return handleJsxSpreadChild(child);
  }

  // handle variable
  if (isVariableComponent(child) && t.isJSXElement(child)) {
    return createVariable(child, index);
  }

  // handle element or fragment
  return createJsxElement(child, index);
}

/**
 * Create jsxChildren
 */
function createJsxChildren(
  children: t.JSXElement['children'],
  index: IndexObject
): JsxChildren {
  return children.map((child) => createJsxChild(child, index));
}

/* =============================== */
/* Entry Point */
/* =============================== */

/**
 * Hash jsx source, this must be called on a <T> or <Tx> component
 */
export function hashJsx(source: t.JSXElement): string {
  // Validate that the source is a <T> or <Tx> component
  const componentType = getComponentType(source);
  if (!componentType || !isTranslationComponent(source)) {
    throw createError(
      `Source is not a <T> or <Tx> component! Instead got: <${componentType}>`,
      source
    );
  }

  // Collect relevant data for hashing
  const index = new IndexObject();
  const jsxChildren = createJsxChildren(source.children, index);
  const id = getAttr(source, 'id') || getAttr(source, '$id') || undefined;
  const context =
    getAttr(source, 'context') || getAttr(source, '$context') || undefined;

  // Hash the source
  return hashSource({
    source: jsxChildren,
    id,
    context,
    dataFormat: 'JSX',
  });
}
