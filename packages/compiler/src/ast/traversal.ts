import * as t from '@babel/types';
import { PLURAL_FORMS } from './constants';
import {
  buildSanitizedTextContent,
  filterJsxChildren,
  getTagName,
  getVariableType,
  jsNumberToString,
} from './utilities';
import {
  SanitizedChild,
  SanitizedChildren,
  SanitizedElement,
  SanitizedGtProp,
  SanitizedVariable,
  VariableType,
  SanitizedData,
  JsxHasher,
} from '../hash';

// Temporary types until we implement the full visitor system
type TransformVisitor = {
  importTracker: {
    scopeTracker: {
      getTranslationVariable(name: string): { originalName: string } | null;
    };
    namespaceImports: Set<string>;
  };
  shouldTrackComponentAsTranslation(tagName: string): boolean;
  shouldTrackComponentAsBranch(tagName: string): boolean;
  shouldTrackComponentAsVariable(tagName: string): boolean;
  shouldTrackNamespaceComponent(
    namespace: string,
    component: string
  ): [boolean, boolean, boolean];
};

// Temporary function until we implement jsx-utils
function extractAttributeFromJsxAttr(
  element: t.JSXElement,
  attrName: string
): string | null {
  for (const attr of element.openingElement.attributes) {
    if (
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === attrName
    ) {
      if (attr.value && t.isStringLiteral(attr.value)) {
        return attr.value.value;
      }
    }
  }
  return null;
}

/**
 * Information about a GT component extracted during analysis
 */
interface ComponentInfo {
  isGtComponent: boolean;
  transformation?: string;
  variableType?: VariableType;
  branches?: Map<string, SanitizedChild>;
}

/**
 * AST traversal for converting JSX to sanitized GT objects
 */
export class JsxTraversal {
  private visitor: TransformVisitor;
  private idCounter: number = 0;

  constructor(visitor: TransformVisitor) {
    this.visitor = visitor;
  }

  /**
   * Calculate the hash of a JSX element
   */
  public calculateElementHash(element: t.JSXElement): [string, string] {
    // Build sanitized children directly from JSX children
    const sanitizedChildren = this.buildSanitizedChildren(element.children);

    if (sanitizedChildren) {
      // Get the id from the element
      const id =
        extractAttributeFromJsxAttr(element, 'id') ||
        extractAttributeFromJsxAttr(element, '$id');

      // Get the context from the element
      const context =
        extractAttributeFromJsxAttr(element, 'context') ||
        extractAttributeFromJsxAttr(element, '$context');

      // Create the full SanitizedData structure to match TypeScript implementation
      const sanitizedData: SanitizedData = {
        source: sanitizedChildren,
        id: id || undefined,
        context: context || undefined,
        dataFormat: 'JSX',
      };

      // Calculate hash using stable stringify (like TypeScript fast-json-stable-stringify)
      const jsonString = JsxHasher.stableStringify(sanitizedData);
      const hash = JsxHasher.hashString(jsonString);
      return [hash, jsonString];
    } else {
      // Fallback to empty content hash with proper wrapper structure
      const emptyElement: SanitizedElement = {
        b: undefined,
        c: undefined,
        t: undefined,
        d: undefined,
      };

      const emptyChildren: SanitizedChildren = emptyElement; // Single variant unwraps to the child

      const sanitizedData: SanitizedData = {
        source: emptyChildren,
        id: undefined,
        context: undefined,
        dataFormat: 'JSX',
      };

      const jsonString = JsxHasher.stableStringify(sanitizedData);
      const hash = JsxHasher.hashString(jsonString);
      return [hash, jsonString];
    }
  }

  /**
   * Build sanitized children objects directly from JSX children
   */
  public buildSanitizedChildren(
    children: (
      | t.JSXText
      | t.JSXExpressionContainer
      | t.JSXSpreadChild
      | t.JSXElement
      | t.JSXFragment
    )[]
  ): SanitizedChildren | null {
    const filteredChildren = filterJsxChildren(children);

    // If there are no children, return null
    if (filteredChildren.length === 0) {
      return null;
    }

    if (filteredChildren.length === 1) {
      const child = filteredChildren[0];
      const sanitizedChild = this.buildSanitizedChild(child, true, true);
      if (sanitizedChild) {
        return sanitizedChild; // Single variant unwraps to the child directly
      }
      return null;
    }

    const sanitizedChildren: SanitizedChild[] = [];
    for (let i = 0; i < filteredChildren.length; i++) {
      const child = filteredChildren[i];
      const isFirst = i === 0;
      const isLast = i === filteredChildren.length - 1;
      const sanitizedChild = this.buildSanitizedChild(child, isFirst, isLast);
      if (sanitizedChild) {
        sanitizedChildren.push(sanitizedChild);
      }
    }

    if (sanitizedChildren.length > 0) {
      return sanitizedChildren; // Multiple variant is just the array
    }

    return null;
  }

  /**
   * Build a sanitized child with a specific counter context (for branches)
   */
  private buildSanitizedChildWithCounter(
    child:
      | t.JSXText
      | t.JSXExpressionContainer
      | t.JSXSpreadChild
      | t.JSXElement
      | t.JSXFragment,
    counter: number,
    isFirstSibling: boolean,
    isLastSibling: boolean
  ): SanitizedChild | null {
    const savedCounter = this.idCounter;
    this.idCounter = counter;
    const result = this.buildSanitizedChild(
      child,
      isFirstSibling,
      isLastSibling
    );
    this.idCounter = savedCounter;
    return result;
  }

  /**
   * Build sanitized children with a specific counter context (for branches)
   */
  private buildSanitizedChildrenWithCounter(
    children: (
      | t.JSXText
      | t.JSXExpressionContainer
      | t.JSXSpreadChild
      | t.JSXElement
      | t.JSXFragment
    )[],
    counter: number
  ): SanitizedChildren | null {
    const savedCounter = this.idCounter;
    this.idCounter = counter;
    const result = this.buildSanitizedChildren(children);
    this.idCounter = savedCounter;
    return result;
  }

  private buildSanitizedText(text: t.JSXText): SanitizedChild | null {
    // Normalize whitespace like JS
    const sanitizedText = buildSanitizedTextContent(text);

    if (sanitizedText === null) {
      return null;
    }

    return sanitizedText; // Text variant is just the string
  }

  /**
   * Build a sanitized child directly from JSX child
   */
  public buildSanitizedChild(
    child:
      | t.JSXText
      | t.JSXExpressionContainer
      | t.JSXSpreadChild
      | t.JSXElement
      | t.JSXFragment,
    isFirstSibling: boolean,
    isLastSibling: boolean
  ): SanitizedChild | null {
    if (t.isJSXText(child)) {
      return this.buildSanitizedText(child);
    } else if (t.isJSXFragment(child)) {
      // Increment counter for each JSX element we encounter
      this.idCounter += 1;

      // Check if children are present
      const children = this.buildSanitizedChildren(child.children);
      if (children) {
        const wrappedChildren: SanitizedChildren = { c: children };
        return wrappedChildren; // Fragment variant is SanitizedChildren::Wrapped
      } else {
        const emptyElement: SanitizedElement = {
          b: undefined,
          c: undefined,
          t: undefined,
          d: undefined,
        };
        return emptyElement; // Element variant is the element directly
      }
    } else if (t.isJSXElement(child)) {
      // Increment counter for each JSX element we encounter
      this.idCounter += 1;

      // Check if this is a variable component first (Var, Num, Currency, DateTime)
      const variable = this.buildSanitizedVariable(child);
      if (variable) {
        return variable; // Variable variant is the variable directly
      } else {
        // Build as element (includes Branch/Plural components with branches)
        const element = this.buildSanitizedElement(child);
        if (element) {
          return element; // Element variant is the element directly
        }
      }
    } else if (t.isJSXExpressionContainer(child)) {
      return this.buildSanitizedChildFromJsxExpr(
        child.expression,
        !(isFirstSibling && isLastSibling),
        false
      );
    }

    return null; // Skip fragments and other types for now
  }

  /**
   * Check if a Plural component is valid
   */
  private isValidPluralComponent(
    element: t.JSXElement,
    componentInfo: ComponentInfo
  ): boolean {
    // Check if component has required 'n' attribute
    const hasNAttr = element.openingElement.attributes.some((attr) => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        return attr.name.name === 'n';
      }
      return false;
    });

    // Check if has valid branches OR children
    if (
      !hasNAttr ||
      (!componentInfo.branches && element.children.length === 0)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if a Branch component is valid
   */
  private isValidBranchComponent(
    element: t.JSXElement,
    componentInfo: ComponentInfo
  ): boolean {
    // Check if component has required 'branch' attribute
    const hasBranchAttr = element.openingElement.attributes.some((attr) => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        return attr.name.name === 'branch';
      }
      return false;
    });

    // Check if has valid branches OR children
    if (
      !hasBranchAttr ||
      (!componentInfo.branches && element.children.length === 0)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Build a sanitized element directly from JSX element
   */
  public buildSanitizedElement(element: t.JSXElement): SanitizedElement | null {
    const tagName = getTagName(element.openingElement.name);
    if (!tagName) {
      return null;
    }

    // Check if this is a GT component
    const componentInfo = this.analyzeGtComponent(
      tagName,
      element.openingElement.attributes
    );

    // Variable components should be handled as SanitizedVariable, not SanitizedElement
    if (componentInfo.variableType) {
      return null; // This will be handled by build_sanitized_variable
    }

    // Branch and Plural components are handled as SanitizedElements with branches
    const sanitizedElement: SanitizedElement = {
      b: undefined, // Will be set for Branch/Plural components
      c: undefined,
      t: undefined, // Will be set based on component type
      d: undefined,
    };

    // Build children directly as sanitized
    if (element.children.length > 0) {
      const children = this.buildSanitizedChildren(element.children);
      if (children) {
        sanitizedElement.c = children;
      }
    }

    // Handle different component types
    if (componentInfo.isGtComponent) {
      if (this.isPluralComponent(tagName)) {
        if (!this.isValidPluralComponent(element, componentInfo)) {
          return null;
        }
        if (componentInfo.branches) {
          const branchesObj: Record<string, SanitizedChild> = {};
          for (const [key, value] of componentInfo.branches) {
            branchesObj[key] = value;
          }
          sanitizedElement.b = branchesObj;
        }
        sanitizedElement.t = componentInfo.transformation;
      } else if (this.isBranchComponent(tagName)) {
        if (!this.isValidBranchComponent(element, componentInfo)) {
          return null;
        }
        if (componentInfo.branches) {
          const branchesObj: Record<string, SanitizedChild> = {};
          for (const [key, value] of componentInfo.branches) {
            branchesObj[key] = value;
          }
          sanitizedElement.b = branchesObj;
        }
        sanitizedElement.t = componentInfo.transformation;
      } else {
        // Handle other GT components (T, etc.) with GT data
        const gtProp: SanitizedGtProp = {
          b: componentInfo.branches
            ? (() => {
                const branchesObj: Record<string, SanitizedChild> = {};
                for (const [key, value] of componentInfo.branches) {
                  branchesObj[key] = value;
                }
                return branchesObj;
              })()
            : undefined,
          t: componentInfo.transformation,
        };
        sanitizedElement.d = gtProp;
        sanitizedElement.t = tagName;
      }
    } else {
      // For non-GT elements, create empty placeholder to match runtime {}
      sanitizedElement.t = undefined;
    }

    return sanitizedElement;
  }

  /**
   * Build a sanitized variable directly from JSX element
   */
  private buildSanitizedVariable(
    element: t.JSXElement
  ): SanitizedVariable | null {
    const tagName = getTagName(element.openingElement.name);
    if (!tagName) {
      return null;
    }

    const componentInfo = this.analyzeGtComponent(
      tagName,
      element.openingElement.attributes
    );

    if (componentInfo.variableType) {
      // Extract variable name from children or attributes with proper prefix
      const variableKey = this.extractVariableKey(
        element,
        componentInfo.variableType
      );

      return {
        k: variableKey,
        v: componentInfo.variableType,
        t: undefined,
      };
    }

    return null;
  }

  /**
   * Extract variable key from JSX element (from children or name attribute)
   */
  private extractVariableKey(
    element: t.JSXElement,
    varType: VariableType
  ): string {
    // First, check for a 'name' attribute
    for (const attr of element.openingElement.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        if (attr.name.name === 'name') {
          if (attr.value && t.isStringLiteral(attr.value)) {
            if (attr.value.value.length > 0) {
              return attr.value.value;
            }
          }
        }
      }
    }

    // Fallback: generate proper key based on variable type with current counter
    switch (varType) {
      case VariableType.Number:
        return `_gt_n_${this.idCounter}`;
      case VariableType.Currency:
        return `_gt_cost_${this.idCounter}`;
      case VariableType.Date:
        return `_gt_date_${this.idCounter}`;
      case VariableType.Variable:
        return `_gt_value_${this.idCounter}`;
    }
  }

  /**
   * Check if this is a Branch component
   */
  public isBranchComponent(tagName: string): boolean {
    // Named import
    const translationVariable =
      this.visitor.importTracker.scopeTracker.getTranslationVariable(tagName);
    if (translationVariable && translationVariable.originalName === 'Branch') {
      return true;
    }

    // Namespace import
    if (tagName.endsWith('.Branch')) {
      const namespace = tagName.split('.')[0] || '';
      if (this.visitor.importTracker.namespaceImports.has(namespace)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if this is a Plural component
   */
  public isPluralComponent(tagName: string): boolean {
    // Named import
    const translationVariable =
      this.visitor.importTracker.scopeTracker.getTranslationVariable(tagName);
    if (translationVariable && translationVariable.originalName === 'Plural') {
      return true;
    }

    // Namespace import
    if (tagName.endsWith('.Plural')) {
      const namespace = tagName.split('.')[0] || '';
      if (this.visitor.importTracker.namespaceImports.has(namespace)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Analyze GT component and extract information
   */
  private analyzeGtComponent(
    tagName: string,
    attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]
  ): ComponentInfo {
    const componentInfo: ComponentInfo = {
      isGtComponent: false,
      transformation: undefined,
      variableType: undefined,
      branches: undefined,
    };

    // Check if this is a GT component using the visitor's tracking methods
    if (this.visitor.shouldTrackComponentAsTranslation(tagName)) {
      componentInfo.isGtComponent = true;
    } else if (this.visitor.shouldTrackComponentAsBranch(tagName)) {
      // Branch and Plural components
      componentInfo.isGtComponent = true;

      // Determine transformation type
      if (this.isBranchComponent(tagName)) {
        componentInfo.transformation = 'b';
        componentInfo.branches = this.extractBranchProps(attributes);
      } else if (this.isPluralComponent(tagName)) {
        componentInfo.transformation = 'p';
        componentInfo.branches = this.extractPluralProps(attributes);
      }
    } else if (this.visitor.shouldTrackComponentAsVariable(tagName)) {
      componentInfo.isGtComponent = true;
      componentInfo.transformation = 'v';
      componentInfo.variableType = getVariableType(tagName);
    }

    // Handle namespace components (GT.T, GT.Var, etc.)
    if (tagName.includes('.')) {
      const parts = tagName.split('.');
      if (parts.length === 2) {
        const [namespace, component] = parts;

        const [isTranslation, isVariable, isBranch] =
          this.visitor.shouldTrackNamespaceComponent(namespace, component);

        if (isTranslation) {
          componentInfo.isGtComponent = true;
        } else if (isBranch) {
          componentInfo.isGtComponent = true;
          switch (component) {
            case 'Branch':
              componentInfo.transformation = 'b';
              componentInfo.branches = this.extractBranchProps(attributes);
              break;
            case 'Plural':
              componentInfo.transformation = 'p';
              componentInfo.branches = this.extractPluralProps(attributes);
              break;
            default:
              componentInfo.transformation = 'fragment';
              break;
          }
        } else if (isVariable) {
          componentInfo.isGtComponent = true;
          componentInfo.transformation = 'v';
          componentInfo.variableType = getVariableType(component);
        }
      }
    }

    return componentInfo;
  }

  /**
   * Extract branch props from Branch component attributes
   */
  private extractBranchProps(
    attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]
  ): Map<string, SanitizedChild> | undefined {
    const branches = new Map<string, SanitizedChild>();

    for (const attr of attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const propName = attr.name.name;

        // Skip special props
        if (propName === 'branch') {
          continue;
        }

        // Build sanitized branch content directly
        if (attr.value) {
          const sanitizedChild = this.buildSanitizedChildFromAttrValue(
            attr.value
          );
          if (sanitizedChild) {
            branches.set(propName, sanitizedChild);
          }
        }
      }
    }

    return branches.size > 0 ? branches : undefined;
  }

  /**
   * Extract plural props from Plural component attributes
   */
  private extractPluralProps(
    attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]
  ): Map<string, SanitizedChild> | undefined {
    const branches = new Map<string, SanitizedChild>();

    for (const attr of attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const propName = attr.name.name;

        // Only include valid plural forms
        if (PLURAL_FORMS.has(propName)) {
          if (attr.value) {
            const sanitizedChild = this.buildSanitizedChildFromAttrValue(
              attr.value
            );
            if (sanitizedChild) {
              branches.set(propName, sanitizedChild);
            }
          }
        }
      }
    }

    return branches.size > 0 ? branches : undefined;
  }

  /**
   * Build sanitized children directly from JSX attribute value
   */
  private buildSanitizedChildFromAttrValue(
    value: t.JSXAttribute['value']
  ): SanitizedChild | null {
    if (t.isStringLiteral(value)) {
      return value.value; // Text variant is just the string
    } else if (t.isJSXExpressionContainer(value)) {
      return this.buildSanitizedChildFromJsxExpr(value.expression, false, true);
    }

    return null; // Skip fragments and other types for now
  }

  /**
   * Build sanitized child from JSX expression
   */
  private buildSanitizedChildFromJsxExpr(
    expr: t.Expression | t.JSXEmptyExpression,
    hasSiblings: boolean,
    isAttribute: boolean
  ): SanitizedChild | null {
    if (t.isJSXEmptyExpression(expr)) {
      return null;
    }

    // Handle different expression types
    if (t.isBooleanLiteral(expr)) {
      if (isAttribute) {
        return expr.value; // Boolean variant is just the boolean value
      } else if (expr.value && !hasSiblings) {
        // Yeah i know this is dumb, but it's what runtime does
        return true; // Boolean variant
      } else {
        return null;
      }
    } else if (t.isNullLiteral(expr)) {
      if (isAttribute) {
        return null; // Null variant is just null
      } else {
        return null;
      }
    } else if (t.isJSXFragment(expr)) {
      // Fragment becomes one SanitizedChild::Fragment containing its children
      const childrenOption = isAttribute
        ? this.buildSanitizedChildrenWithCounter(
            expr.children,
            this.idCounter + 1
          )
        : this.buildSanitizedChildren(expr.children);

      if (childrenOption) {
        const wrappedChildren: SanitizedChildren = { c: childrenOption };
        return wrappedChildren; // Fragment variant is SanitizedChildren::Wrapped
      } else {
        // Empty fragment should return empty object structure, not null
        const emptyElement: SanitizedElement = {
          b: undefined,
          c: undefined,
          t: undefined,
          d: undefined,
        };
        return emptyElement; // Element variant
      }
    } else if (t.isJSXElement(expr)) {
      if (isAttribute) {
        return this.buildSanitizedChildWithCounter(
          expr,
          this.idCounter,
          true,
          true
        );
      } else {
        return this.buildSanitizedChild(expr, true, true);
      }
    } else if (t.isStringLiteral(expr)) {
      return expr.value; // Text variant is just the string
    } else if (t.isNumericLiteral(expr)) {
      return jsNumberToString(expr.value); // Text variant for numbers
    } else if (t.isUnaryExpression(expr)) {
      if (t.isNumericLiteral(expr.argument)) {
        switch (expr.operator) {
          case '-':
            const negativeNum = -expr.argument.value;
            if (negativeNum === 0) {
              return jsNumberToString(expr.argument.value); // Text variant
            } else {
              return jsNumberToString(negativeNum); // Text variant
            }
          case '+':
            return jsNumberToString(expr.argument.value); // Text variant
          default:
            return null;
        }
      } else {
        return null;
      }
    } else if (t.isTemplateLiteral(expr)) {
      if (expr.expressions.length === 0 && expr.quasis.length === 1) {
        const quasi = expr.quasis[0];
        if (quasi && quasi.value.cooked !== null) {
          return quasi.value.cooked; // Text variant
        } else if (quasi) {
          return quasi.value.raw; // Text variant
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else if (t.isIdentifier(expr)) {
      switch (expr.name) {
        case 'NaN':
          return 'NaN'; // Text variant
        case 'Infinity':
          return 'Infinity'; // Text variant
        case 'undefined':
          return null;
        default:
          return null;
      }
    }

    return null;
  }
}
