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
  VARIABLE_COMPONENTS,
  BRANCH_COMPONENT,
  PLURAL_COMPONENT,
  VAR_COMPONENT,
  DEFAULT_GT_IMPORT_SOURCE,
  DERIVE_COMPONENT,
  STATIC_COMPONENT,
} from '../constants.js';
import { Libraries } from '../../../../types/libraries.js';

/**
 * GT library import sources that we recognize when checking for existing imports.
 */
const GT_IMPORT_SOURCES = [
  Libraries.GT_NEXT,
  Libraries.GT_REACT,
  DEFAULT_GT_IMPORT_SOURCE,
  'gt-next/client',
  'gt-next/server',
  'gt-react/client',
  'gt-i18n',
];

/** Tracks which AST nodes were auto-inserted by this module */
const autoInsertedNodes = new WeakSet<t.Node>();

/** Check if a node was auto-inserted */
export function isAutoInserted(node: t.Node): boolean {
  return autoInsertedNodes.has(node);
}

// ===== Public API ===== //

/**
 * Ensure T and Var are imported in the AST. If not already imported from
 * a GT source, adds: import { T, Var } from 'gt-react/browser';
 *
 * Updates importAliases in-place.
 */
export function ensureTAndVarImported(
  ast: t.File,
  importAliases: Record<string, string>
): void {
  // Check both importAliases AND the AST's import declarations for T/Var.
  // getPathsAndAliases puts T into translationComponentPaths (not importAliases),
  // so we also scan the AST directly.
  let hasT = Object.values(importAliases).includes(TRANSLATION_COMPONENT);
  let hasVar = Object.values(importAliases).includes(VAR_COMPONENT);

  // Scan existing imports for T and Var from GT sources
  const gtSources = GT_IMPORT_SOURCES;

  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    if (!gtSources.some((src) => node.source.value.startsWith(src))) continue;
    for (const spec of node.specifiers) {
      if (!t.isImportSpecifier(spec) || !t.isIdentifier(spec.imported))
        continue;
      if (spec.imported.name === TRANSLATION_COMPONENT) {
        hasT = true;
        importAliases[spec.local.name] = TRANSLATION_COMPONENT;
      }
      if (spec.imported.name === VAR_COMPONENT) {
        hasVar = true;
        importAliases[spec.local.name] = VAR_COMPONENT;
      }
    }
  }

  if (hasT && hasVar) return;

  const specifiers: t.ImportSpecifier[] = [];
  if (!hasT) {
    specifiers.push(
      t.importSpecifier(
        t.identifier(TRANSLATION_COMPONENT),
        t.identifier(TRANSLATION_COMPONENT)
      )
    );
    importAliases[TRANSLATION_COMPONENT] = TRANSLATION_COMPONENT;
  }
  if (!hasVar) {
    specifiers.push(
      t.importSpecifier(
        t.identifier(VAR_COMPONENT),
        t.identifier(VAR_COMPONENT)
      )
    );
    importAliases[VAR_COMPONENT] = VAR_COMPONENT;
  }

  const importDecl = t.importDeclaration(
    specifiers,
    t.stringLiteral(DEFAULT_GT_IMPORT_SOURCE)
  );

  // Insert at top of file
  traverse(ast, {
    Program(path) {
      path.unshiftContainer('body', importDecl);
      path.stop();
    },
  });
}

/**
 * Traverse the AST and insert <T> and <Var> JSX elements following
 * the insertion rules. Uses deliberate children traversal.
 *
 * Every inserted node gets node._autoInserted = true.
 */
export function autoInsertJsxComponents(
  ast: t.File,
  importAliases: Record<string, string>
): void {
  const processedNodes = new WeakSet<t.Node>();
  const tLocalName = getLocalName(importAliases, TRANSLATION_COMPONENT);
  const varLocalName = getLocalName(importAliases, VAR_COMPONENT);

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
}: { path: NodePath<t.JSXElement> } & InsertionContext): void {
  // Mark all descendant JSX in children and props as processed
  markDescendantJsx(path, processedNodes);

  if (!insideAutoT) return;

  // Wrap dynamic prop values in <Var>
  const attrs = path.get('openingElement').get('attributes');
  for (const attrPath of attrs) {
    if (!attrPath.isJSXAttribute()) continue;
    const valuePath = attrPath.get('value');
    if (
      valuePath.isJSXExpressionContainer() &&
      needsVarWrapping(valuePath.node)
    ) {
      // Check it's not static JSX inside the expression
      const expr = valuePath.node.expression;
      if (t.isJSXElement(expr) || t.isJSXFragment(expr)) continue;

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
