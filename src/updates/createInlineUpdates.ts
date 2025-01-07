import React from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Options, Updates } from "../main";

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import addGTIdentifierToSyntaxTree from '../data-_gt/addGTIdentifierToSyntaxTree';
import { hashReactChildrenObjects } from 'gt-react/internal';
import { displayFoundTMessage } from '../console/console';
import { warnHasUnwrappedExpression, warnNoId, warnVariableProp } from '../console/warnings';

export default async function createInlineUpdates(
  options: Options
): Promise<Updates> {
  const updates: Updates = [];

  // Use the provided app directory or default to the current directory
  const appDirectory = options.app || './';

  // Define the file extensions to look for
  const extensions = ['.js', '.jsx', '.tsx'];

  /**
   * Recursively scan the directory and collect all files with the specified extensions,
   * excluding files or directories that start with a dot (.)
   * @param dir - The directory to scan
   * @returns An array of file paths
   */
  function getFiles(dir: string): string[] {
    let files: string[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      // Skip hidden files and directories
      if (item.startsWith('.')) continue;

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        files = files.concat(getFiles(fullPath));
      } else if (extensions.includes(path.extname(item))) {
        // Add files with the specified extensions
        files.push(fullPath);
      }
    }

    return files;
  }

  const files = getFiles(appDirectory);

  // Declare which components are considered valid "variable containers"
  const variableComponents = ["Var", "DateTime", "Currency", "Num"];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch (error) {
      console.error(`Error parsing file ${file}:`, error);
      continue;
    }

    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const name = openingElement.name;

        // Only proceed if it's <T> ...
        if (name.type === 'JSXIdentifier' && name.name === 'T') {
          const componentObj: any = { props: {} };

          // We'll track this flag to know if any unwrapped {variable} is found in children
          let hasUnwrappedExpression = false;

          // We'll also track if `id` or `context` is variable
          let hasVariableIdOrContext = false;

          // The buildJSXTree function that handles children recursion
          function buildJSXTree(node: any, isInsideVar = false): any {
            // If we find a { foo } as a direct child and we're not inside <Var>, <DateTime>, <Currency>, or <Num>
            if (t.isJSXExpressionContainer(node) && !isInsideVar) {
              // Mark that we found an unwrapped expression
              hasUnwrappedExpression = true;
              // Return the code but note we've flagged it
              return generate(node).code;
            }

            // JSX Text
            if (t.isJSXText(node)) {
              // Trim the text and replace multiple whitespaces with a single space
              return node.value.trim().replace(/\s+/g, ' ');
            }
            // If we are inside a variable component, keep going
            else if (t.isJSXExpressionContainer(node)) {
              return buildJSXTree(node.expression, isInsideVar);

            // If it's a JSX element
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

              // If this JSXElement is one of the recognized variable components,
              // then for its children we set isInsideVar = true
              const nextInsideVar = variableComponents.includes(typeName ?? '')
                ? true
                : isInsideVar;

              const props: { [key: string]: any } = {};
              element.openingElement.attributes.forEach((attr) => {
                if (t.isJSXAttribute(attr)) {
                  const attrName = attr.name.name;
                  let attrValue = null;
                  if (attr.value) {
                    if (t.isStringLiteral(attr.value)) {
                      attrValue = attr.value.value;
                    } else if (t.isJSXExpressionContainer(attr.value)) {
                      attrValue = buildJSXTree(attr.value.expression, nextInsideVar);
                    }
                  }
                  props[attrName as any] = attrValue;
                } else if (t.isJSXSpreadAttribute(attr)) {
                  props['...'] = generate(attr.argument).code;
                }
              });

              const children = element.children
                .map((child) => buildJSXTree(child, nextInsideVar))
                .filter((child) => child !== null && child !== '');

              if (children.length === 1) {
                props.children = children[0];
              } else if (children.length > 1) {
                props.children = children;
              }

              return {
                type: typeName,
                props,
              };
            }
            // If it's a JSX fragment
            else if (t.isJSXFragment(node)) {
              const children = node.children
                .map((child: any) => buildJSXTree(child, isInsideVar))
                .filter((child: any) => child !== null && child !== '');

              return {
                type: '',
                props: {
                  children: children.length === 1 ? children[0] : children
                }
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

          // Gather <T>'s props
          openingElement.attributes.forEach((attr) => {
            if (!t.isJSXAttribute(attr)) return;

            const attrName = attr.name.name;

            if (typeof attrName !== 'string') return;

            // We'll build the value with buildJSXTree, but also
            // specifically check for variable "id" or "context"
            if (attr.value) {
              // If it's a plain string literal like id="hello"
              if (t.isStringLiteral(attr.value)) {
                componentObj.props[attrName] = attr.value.value;
                // If it's `id` or `context` but contains braces, it's variable => skip
                if ((attrName === 'id' || attrName === 'context')
                  && /[{}]/.test(attr.value.value)) {
                  warnVariableProp(file, attrName, attr.value.value);
                  hasVariableIdOrContext = true;
                }
              } 
              // If it's an expression container like id={"hello"}, id={someVar}, etc.
              else if (t.isJSXExpressionContainer(attr.value)) {
                const generatedVal = generate(attr.value.expression).code;
                componentObj.props[attrName] = generatedVal;

                // If that expression is not a simple string literal, skip
                // But we need to detect if it's actually just {"hello"} vs {myVar}
                if (attrName === 'id' || attrName === 'context') {
                  // Check if the expression inside is a string literal
                  if (t.isStringLiteral(attr.value.expression)) {
                    // It's static => e.g. {"hello"}
                    // But we still check for braces inside the string
                    if (/[{}]/.test(attr.value.expression.value)) {
                      warnVariableProp(file, attrName, attr.value.expression.value)
                      hasVariableIdOrContext = true;
                    } else {
                      // It's a static string, so we are good
                      componentObj.props[attrName] = attr.value.expression.value;
                    }
                  } else {
                    // Expression is something else => definitely variable
                    warnVariableProp(file, attrName, generatedVal)
                    hasVariableIdOrContext = true;
                  }
                }
              }
            }
          });

          // If we already found a variable `id` or `context`, skip immediately
          if (hasVariableIdOrContext) {
            return;
          }

          // Build and store the "children" / tree
          const tree = path.node.children
            .map((child) => buildJSXTree(child))
            .filter((child) => child !== null && child !== '');

          componentObj.tree = tree.length === 1 ? tree[0] : tree;

          // Check the id ...
          const id = componentObj.props.id;
          // If user forgot to provide an `id`, warn
          if (!id) {
            warnNoId(file)
            return;
          }

          // If we found an unwrapped expression, skip
          if (hasUnwrappedExpression) {
            warnHasUnwrappedExpression(file, id);
            return;
          }

          // If we reached here, this <T> is valid
          const childrenAsObjects = addGTIdentifierToSyntaxTree(componentObj.tree);
          displayFoundTMessage(file, id);

          updates.push({
            type: "jsx",
            source: childrenAsObjects,
            metadata: componentObj.props
          });
        }
      },
    });
  }

  // Post-process to add a hash to each update
  await Promise.all(
    updates.map(async (update) => {
      const context = update.metadata.context;
      const hash = hashReactChildrenObjects(
        context ? [update.source, context] : update.source
      );
      update.metadata.hash = hash;
    })
  );

  return updates;
}
