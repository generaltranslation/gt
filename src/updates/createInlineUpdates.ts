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

        if (name.type === 'JSXIdentifier' && name.name === 'T') {
          const componentObj: any = { props: {} };

          openingElement.attributes.forEach((attr) => {
            if (attr.type === 'JSXAttribute') {
              const attrName = attr.name.name;
              let attrValue = null;
              if (attr.value) {
                if (attr.value.type === 'StringLiteral') {
                  attrValue = attr.value.value;
                } else if (attr.value.type === 'JSXExpressionContainer') {
                  attrValue = buildJSXTree(attr.value.expression);
                }
              }
              componentObj.props[attrName as any] = attrValue;
            }
          });

          function buildJSXTree(node: any): any {
            if (t.isJSXText(node)) {
              // Trim the text and replace multiple whitespaces with a single space
              return node.value.trim().replace(/\s+/g, ' ');
            } else if (t.isJSXExpressionContainer(node)) {
              return buildJSXTree(node.expression);
            } else if (t.isJSXElement(node)) {
              const element = node;
              const openingElement = element.openingElement;
              const elementName = openingElement.name;
              let typeName;
              if (t.isJSXIdentifier(elementName)) {
                typeName = elementName.name;
              } else if (t.isJSXMemberExpression(elementName)) {
                typeName = generate(elementName).code;
              } else {
                typeName = null;
              }
          
              const props: { [key: string]: any } = {};
              openingElement.attributes.forEach((attr) => {
                if (t.isJSXAttribute(attr)) {
                  const attrName = attr.name.name;
                  let attrValue = null;
                  if (attr.value) {
                    if (t.isStringLiteral(attr.value)) {
                      attrValue = attr.value.value;
                    } else if (t.isJSXExpressionContainer(attr.value)) {
                      attrValue = buildJSXTree(attr.value.expression);
                    }
                  }
                  props[attrName as any] = attrValue;
                } else if (t.isJSXSpreadAttribute(attr)) {
                  props['...'] = generate(attr.argument).code;
                }
              });
          
              const children = element.children
                .map((child) => buildJSXTree(child))
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
            } else if (t.isJSXFragment(node)) {
              const children = node.children
                .map((child) => buildJSXTree(child))
                .filter((child) => child !== null && child !== '');
              
              return {
                type: "",
                props: {
                  children: children.length === 1 ? children[0] : children
                }
              };
            } else if (t.isStringLiteral(node)) {
              return node.value;
            } else if (t.isIdentifier(node) || t.isMemberExpression(node) ||
                       t.isCallExpression(node) || t.isBinaryExpression(node) ||
                       t.isLogicalExpression(node) || t.isConditionalExpression(node)) {
              return generate(node).code;
            } else {
              return generate(node).code;
            }
          }

          const tree = path.node.children
            .map((child) => buildJSXTree(child))
            .filter((child) => child !== null && child !== '');

          componentObj.tree = tree.length === 1 ? tree[0] : tree;

          const id = componentObj.props.id;
          
          if (id) {
            if (/[{}]/.test(id)) {
                console.warn(`Found <T> component in ${file} with potentially variable id: "${id}". <T> components with variable IDs are translated at runtime.`);
            } else if (/[{}]/.test(componentObj.props?.context || '')) {
                console.warn(`Found <T> component in ${file} with potentially variable context. { id: "${id}", context: "${componentObj.props?.context}" }. <T> components with variable context are translated at runtime.`);
            } else {
                const childrenAsObjects = addGTIdentifierToSyntaxTree(componentObj.tree);
                console.log(`Found <T> component in ${file} with id "${id}".`);
                updates.push({
                    type: "jsx",
                    data: {
                        source: childrenAsObjects,
                        metadata: componentObj.props
                    }
                });
            }
            
          }
          else {
            console.warn(`Found <T> component in ${file} with no id. <T> components without IDs are translated at runtime.`);
          }
        }
      },
    });
  }

  await Promise.all(updates.map(async update => {
    const context = update.data.metadata.context;
    const hash = hashReactChildrenObjects(
        context ? [(update.data as any).children, context] : (update.data as any).children
    )
    update.data.metadata.hash = hash;
  }))

  return updates;
}