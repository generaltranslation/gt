import type { SyntaxNode } from './parser.js';
import {
  PYTHON_GT_PACKAGES,
  PYTHON_TRANSLATION_FUNCTIONS,
} from './constants.js';

export type ImportAlias = {
  /** The local name used in the source file (e.g. "translate" for `import t as translate`) */
  localName: string;
  /** The original imported name (e.g. "t") */
  originalName: string;
  /** The package it was imported from (e.g. "gt_flask") */
  packageName: string;
};

/**
 * Extracts GT-related imports from a Python AST.
 *
 * Handles:
 * - `from gt_flask import t`
 * - `from gt_flask import t as translate`
 * - `from gt_flask import t, msg`
 */
export function extractImports(rootNode: SyntaxNode): ImportAlias[] {
  const aliases: ImportAlias[] = [];

  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);
    if (!node || node.type !== 'import_from_statement') continue;

    const moduleName = getModuleName(node);
    if (!moduleName || !isGtPackage(moduleName)) continue;

    // Collect all imported names from this statement
    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);
      if (!child) continue;

      if (child.type === 'aliased_import') {
        // `from gt_flask import t as translate`
        const nameNode = child.childForFieldName('name');
        const aliasNode = child.childForFieldName('alias');
        const originalName = nameNode ? getIdentifierText(nameNode) : undefined;
        const localName = aliasNode ? aliasNode.text : originalName;
        if (originalName && localName && isTranslationFunction(originalName)) {
          aliases.push({ localName, originalName, packageName: moduleName });
        }
      } else if (child.type === 'dotted_name') {
        // Skip the module name itself (first dotted_name is the module)
        const text = child.text;
        if (text === moduleName) continue;
        // `from gt_flask import t` — only track translation functions
        if (isTranslationFunction(text)) {
          aliases.push({
            localName: text,
            originalName: text,
            packageName: moduleName,
          });
        }
      }
    }
  }

  return aliases;
}

function getModuleName(importNode: SyntaxNode): string | undefined {
  const moduleNode = importNode.childForFieldName('module_name');
  if (moduleNode) return moduleNode.text;

  // Fallback: find the first dotted_name child (before 'import' keyword)
  for (let i = 0; i < importNode.childCount; i++) {
    const child = importNode.child(i);
    if (!child) continue;
    if (child.type === 'import') break; // reached the 'import' keyword
    if (child.type === 'dotted_name') return child.text;
  }
  return undefined;
}

function getIdentifierText(node: SyntaxNode): string | undefined {
  if (node.type === 'identifier') return node.text;
  if (node.type === 'dotted_name') {
    // Get the last identifier in a dotted name
    for (let i = node.childCount - 1; i >= 0; i--) {
      const child = node.child(i);
      if (child && child.type === 'identifier') return child.text;
    }
  }
  return node.text;
}

function isGtPackage(name: string): boolean {
  return (PYTHON_GT_PACKAGES as readonly string[]).includes(name);
}

function isTranslationFunction(name: string): boolean {
  return (PYTHON_TRANSLATION_FUNCTIONS as readonly string[]).includes(name);
}
