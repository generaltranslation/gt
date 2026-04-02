/**
 * Auto JSX Insertion for CLI extraction.
 *
 * Inserts <T> and <Var> JSX elements into the AST so the extraction pipeline
 * can process them as if the user wrote them. This operates on raw JSX syntax
 * (JSXElement, JSXText, JSXExpressionContainer) — NOT compiled jsx() calls.
 *
 * Rules follow JSX_INSERTION_RULES.md from the compiler package.
 */
import * as t from '@babel/types';
import traverseModule, { NodePath } from '@babel/traverse';

const traverse: typeof traverseModule.default =
  (traverseModule as any).default || traverseModule;
import { isStaticExpression } from '../../evaluateJsx.js';
import {
  TRANSLATION_COMPONENT,
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
  VARIABLE_COMPONENTS,
  BRANCH_COMPONENT,
  PLURAL_COMPONENT,
  DEFAULT_GT_IMPORT_SOURCE,
  DERIVE_COMPONENT,
  STATIC_COMPONENT,
  BRANCH_CONTROL_PROPS,
  PLURAL_CONTROL_PROPS,
} from '../constants.js';

/** Tracks which AST nodes were auto-inserted by this module */
const autoInsertedNodes = new WeakSet<t.Node>();

/** Check if a node was auto-inserted */
export function isAutoInserted(node: t.Node): boolean {
  return autoInsertedNodes.has(node);
}

// ===== Public API ===== //

/**
 * Ensure GtInternalTranslateJsx and GtInternalVar are imported in the AST.
 * Always adds: import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser';
 * These are distinct from user T/Var so there's no ambiguity.
 *
 * Updates importAliases in-place.
 */
export function ensureTAndVarImported(
  ast: t.File,
  importAliases: Record<string, string>
): void {
  // Check if internal components are already imported
  const hasInternalT = Object.values(importAliases).includes(
    INTERNAL_TRANSLATION_COMPONENT
  );
  const hasInternalVar = Object.values(importAliases).includes(
    INTERNAL_VAR_COMPONENT
  );

  if (hasInternalT && hasInternalVar) return;

  const specifiers: t.ImportSpecifier[] = [];
  if (!hasInternalT) {
    specifiers.push(
      t.importSpecifier(
        t.identifier(INTERNAL_TRANSLATION_COMPONENT),
        t.identifier(INTERNAL_TRANSLATION_COMPONENT)
      )
    );
    importAliases[INTERNAL_TRANSLATION_COMPONENT] =
      INTERNAL_TRANSLATION_COMPONENT;
  }
  if (!hasInternalVar) {
    specifiers.push(
      t.importSpecifier(
        t.identifier(INTERNAL_VAR_COMPONENT),
        t.identifier(INTERNAL_VAR_COMPONENT)
      )
    );
    importAliases[INTERNAL_VAR_COMPONENT] = INTERNAL_VAR_COMPONENT;
  }

  const importDecl = t.importDeclaration(
    specifiers,
    t.stringLiteral(DEFAULT_GT_IMPORT_SOURCE)
  );

  traverse(ast, {
    Program(path) {
      path.unshiftContainer('body', importDecl);
      path.stop();
    },
  });
}

/**
 * Traverse the AST and insert GtInternalTranslateJsx and GtInternalVar JSX elements following
 * the insertion rules. Uses deliberate children traversal.
 *
 * Every inserted node gets node._autoInserted = true.
 */
export function autoInsertJsxComponents(
  ast: t.File,
  importAliases: Record<string, string>
): void {
  const processedNodes = new WeakSet<t.Node>();
  const tLocalName = getLocalName(
    importAliases,
    INTERNAL_TRANSLATION_COMPONENT
  );
  const varLocalName = getLocalName(importAliases, INTERNAL_VAR_COMPONENT);

  traverse(ast, {
    JSXElement(path) {
      if (processedNodes.has(path.node)) return;
      processJsxElement({
        path,
        insideAutoT: false,
        importAliases,
        processedNodes,
        tLocalName,
        varLocalName,
      });
    },
    JSXFragment(path) {
      if (processedNodes.has(path.node)) return;
      processJsxFragment({
        path,
        insideAutoT: false,
        importAliases,
        processedNodes,
        tLocalName,
        varLocalName,
      });
    },
  });
}

// ===== Core recursive functions ===== //

interface InsertionContext {
  insideAutoT: boolean;
  importAliases: Record<string, string>;
  processedNodes: WeakSet<t.Node>;
  tLocalName: string;
  varLocalName: string;
}

function processJsxElement({
  path,
  insideAutoT,
  importAliases,
  processedNodes,
  tLocalName,
  varLocalName,
}: { path: NodePath<t.JSXElement> } & InsertionContext): void {
  processedNodes.add(path.node);

  // Get component type
  const typeName = getElementTypeName(path.node);
  const canonicalName = typeName ? importAliases[typeName] : undefined;

  // User T → mark all descendants, hands off
  if (canonicalName === TRANSLATION_COMPONENT) {
    markDescendantJsx(path, processedNodes);
    return;
  }

  // User Var/Num/Currency/DateTime → mark descendants, hands off
  if (canonicalName && VARIABLE_COMPONENTS.includes(canonicalName)) {
    markDescendantJsx(path, processedNodes);
    return;
  }

  // Branch/Plural/Derive/Static → opaque, process props for dynamic Var
  if (
    canonicalName === BRANCH_COMPONENT ||
    canonicalName === PLURAL_COMPONENT ||
    canonicalName === DERIVE_COMPONENT ||
    canonicalName === STATIC_COMPONENT
  ) {
    processOpaqueComponentProps({
      path,
      insideAutoT,
      importAliases,
      processedNodes,
      tLocalName,
      varLocalName,
      canonicalName,
    });
    return;
  }

  // Process children
  processElementChildren({
    path,
    insideAutoT,
    importAliases,
    processedNodes,
    tLocalName,
    varLocalName,
  });
}

function processJsxFragment({
  path,
  insideAutoT,
  importAliases,
  processedNodes,
  tLocalName,
  varLocalName,
}: { path: NodePath<t.JSXFragment> } & InsertionContext): void {
  processedNodes.add(path.node);

  // Fragments are treated like regular elements
  processFragmentChildren({
    path,
    insideAutoT,
    importAliases,
    processedNodes,
    tLocalName,
    varLocalName,
  });
}

// ===== Children processing ===== //

function processElementChildren({
  path,
  insideAutoT,
  importAliases,
  processedNodes,
  tLocalName,
  varLocalName,
}: { path: NodePath<t.JSXElement> } & InsertionContext): void {
  const children = path.node.children;
  const ctx: InsertionContext = {
    insideAutoT,
    importAliases,
    processedNodes,
    tLocalName,
    varLocalName,
  };

  const hasText = hasTranslatableText(children);
  const hasOpaque = hasOpaqueGTChild(children, importAliases);
  const shouldClaimT = !insideAutoT && (hasText || hasOpaque);

  if (shouldClaimT) {
    // Process children: wrap dynamic expressions in Var, recurse into child elements
    const childPaths = path.get('children');
    for (const childPath of childPaths) {
      processChild(childPath, { ...ctx, insideAutoT: true });
    }
    // Wrap all children in <T>
    wrapChildrenInT(path, tLocalName, processedNodes);
  } else if (insideAutoT) {
    // Inside a T region: wrap dynamic expressions, recurse
    const childPaths = path.get('children');
    for (const childPath of childPaths) {
      processChild(childPath, ctx);
    }
  } else {
    // No text, no opaque, not inside T: just recurse into child elements
    const childPaths = path.get('children');
    for (const childPath of childPaths) {
      if (childPath.isJSXElement() && !processedNodes.has(childPath.node)) {
        processJsxElement({ path: childPath, ...ctx });
      } else if (
        childPath.isJSXFragment() &&
        !processedNodes.has(childPath.node)
      ) {
        processJsxFragment({ path: childPath, ...ctx });
      }
    }
  }
}

function processFragmentChildren({
  path,
  insideAutoT,
  importAliases,
  processedNodes,
  tLocalName,
  varLocalName,
}: { path: NodePath<t.JSXFragment> } & InsertionContext): void {
  const children = path.node.children;
  const ctx: InsertionContext = {
    insideAutoT,
    importAliases,
    processedNodes,
    tLocalName,
    varLocalName,
  };

  const hasText = hasTranslatableText(children);
  const hasOpaque = hasOpaqueGTChild(children, importAliases);
  const shouldClaimT = !insideAutoT && (hasText || hasOpaque);

  if (shouldClaimT) {
    const childPaths = path.get('children');
    for (const childPath of childPaths) {
      processChild(childPath, { ...ctx, insideAutoT: true });
    }
    wrapFragmentChildrenInT(path, tLocalName, processedNodes);
  } else if (insideAutoT) {
    const childPaths = path.get('children');
    for (const childPath of childPaths) {
      processChild(childPath, ctx);
    }
  } else {
    const childPaths = path.get('children');
    for (const childPath of childPaths) {
      if (childPath.isJSXElement() && !processedNodes.has(childPath.node)) {
        processJsxElement({ path: childPath, ...ctx });
      } else if (
        childPath.isJSXFragment() &&
        !processedNodes.has(childPath.node)
      ) {
        processJsxFragment({ path: childPath, ...ctx });
      }
    }
  }
}

function processChild(childPath: NodePath, ctx: InsertionContext): void {
  if (childPath.isJSXElement() && !ctx.processedNodes.has(childPath.node)) {
    processJsxElement({ path: childPath, ...ctx });
  } else if (
    childPath.isJSXFragment() &&
    !ctx.processedNodes.has(childPath.node)
  ) {
    processJsxFragment({ path: childPath, ...ctx });
  } else if (
    childPath.isJSXExpressionContainer() &&
    ctx.insideAutoT &&
    needsVarWrapping(childPath.node)
  ) {
    // Wrap dynamic expression in <Var>
    const varWrapper = createVarWrapper(
      childPath.node,
      ctx.varLocalName,
      ctx.processedNodes
    );
    childPath.replaceWith(varWrapper);
    ctx.processedNodes.add(varWrapper);
  }
}

// ===== Opaque component props ===== //

function processOpaqueComponentProps({
  path,
  insideAutoT,
  importAliases,
  processedNodes,
  tLocalName,
  varLocalName,
  canonicalName,
}: { path: NodePath<t.JSXElement>; canonicalName: string | undefined } & InsertionContext): void {
  // Mark all descendant JSX in children and props as processed
  markDescendantJsx(path, processedNodes);

  if (!insideAutoT) return;

  const ctx: InsertionContext = {
    insideAutoT: true,
    importAliases,
    processedNodes,
    tLocalName,
    varLocalName,
  };

  // Wrap dynamic prop values in <Var>, skipping control props
  const attrs = path.get('openingElement').get('attributes');
  for (const attrPath of attrs) {
    if (!attrPath.isJSXAttribute()) continue;

    // Determine prop name and skip control props
    const nameNode = attrPath.node.name;
    const propName = t.isJSXIdentifier(nameNode) ? nameNode.name : null;
    if (isControlProp(canonicalName, propName)) continue;

    const valuePath = attrPath.get('value');
    if (
      valuePath.isJSXExpressionContainer() &&
      needsVarWrapping(valuePath.node)
    ) {
      const expr = valuePath.node.expression;

      // Content prop with JSX value — recurse into children for Var-wrapping
      if (t.isJSXElement(expr) || t.isJSXFragment(expr)) {
        const exprPath = (valuePath as NodePath<t.JSXExpressionContainer>).get(
          'expression'
        );
        if (exprPath.isJSXElement()) {
          const childPaths = exprPath.get('children');
          for (const childPath of childPaths) {
            processChild(childPath, ctx);
          }
        } else if (exprPath.isJSXFragment()) {
          const childPaths = exprPath.get('children');
          for (const childPath of childPaths) {
            processChild(childPath, ctx);
          }
        }
        continue;
      }

      const varWrapper = createVarWrapper(
        valuePath.node,
        varLocalName,
        processedNodes
      );
      valuePath.replaceWith(varWrapper);
      processedNodes.add(varWrapper);
    }
  }
}

function isControlProp(
  canonicalName: string | undefined,
  propName: string | null
): boolean {
  if (!propName) return false;
  if (canonicalName === BRANCH_COMPONENT) {
    return BRANCH_CONTROL_PROPS.has(propName) || propName.startsWith('data-');
  }
  if (canonicalName === PLURAL_COMPONENT) {
    return PLURAL_CONTROL_PROPS.has(propName);
  }
  return false;
}

// ===== Helper functions ===== //

function getElementTypeName(element: t.JSXElement): string | null {
  const name = element.openingElement.name;
  if (t.isJSXIdentifier(name)) return name.name;
  return null;
}

function getLocalName(
  importAliases: Record<string, string>,
  canonicalName: string
): string {
  const entry = Object.entries(importAliases).find(
    ([, v]) => v === canonicalName
  );
  return entry ? entry[0] : canonicalName;
}

function hasTranslatableText(children: t.Node[]): boolean {
  return children.some(
    (child) => t.isJSXText(child) && child.value.trim().length > 0
  );
}

function hasOpaqueGTChild(
  children: t.Node[],
  importAliases: Record<string, string>
): boolean {
  return children.some((child) => {
    if (!t.isJSXElement(child)) return false;
    const typeName = getElementTypeName(child);
    if (!typeName) return false;
    const canonical = importAliases[typeName];
    return (
      canonical === BRANCH_COMPONENT ||
      canonical === PLURAL_COMPONENT ||
      canonical === DERIVE_COMPONENT ||
      canonical === STATIC_COMPONENT
    );
  });
}

function needsVarWrapping(container: t.JSXExpressionContainer): boolean {
  const expr = container.expression;
  if (t.isJSXEmptyExpression(expr)) return false;

  // Use isStaticExpression to check — if static, no wrapping needed
  const analysis = isStaticExpression(expr, true);
  if (analysis.isStatic) return false;

  // JSX elements/fragments inside expressions are not dynamic — they're valid children
  if (t.isJSXElement(expr) || t.isJSXFragment(expr)) return false;

  return true;
}

// ===== AST construction ===== //

function createTWrapper(
  children: t.JSXElement['children'],
  tName: string
): t.JSXElement {
  const element = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(tName), []),
    t.jsxClosingElement(t.jsxIdentifier(tName)),
    children
  );
  autoInsertedNodes.add(element);
  return element;
}

function createVarWrapper(
  child: t.JSXExpressionContainer,
  varName: string,
  processedNodes: WeakSet<t.Node>
): t.JSXExpressionContainer {
  const varElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(varName), []),
    t.jsxClosingElement(t.jsxIdentifier(varName)),
    [child]
  );
  autoInsertedNodes.add(varElement);
  processedNodes.add(varElement);
  return t.jsxExpressionContainer(varElement);
}

function wrapChildrenInT(
  elementPath: NodePath<t.JSXElement>,
  tName: string,
  processedNodes: WeakSet<t.Node>
): void {
  const children = [...elementPath.node.children];
  const tWrapper = createTWrapper(children, tName);
  processedNodes.add(tWrapper);
  elementPath.node.children = [tWrapper];
}

function wrapFragmentChildrenInT(
  fragmentPath: NodePath<t.JSXFragment>,
  tName: string,
  processedNodes: WeakSet<t.Node>
): void {
  const children = [...fragmentPath.node.children];
  const tWrapper = createTWrapper(children, tName);
  processedNodes.add(tWrapper);
  fragmentPath.node.children = [tWrapper];
}

// ===== Marking descendants as processed ===== //

function markDescendantJsx(
  path: NodePath<t.JSXElement | t.JSXFragment>,
  processedNodes: WeakSet<t.Node>
): void {
  path.traverse({
    JSXElement(childPath) {
      processedNodes.add(childPath.node);
    },
    JSXFragment(childPath) {
      processedNodes.add(childPath.node);
    },
  });
}
