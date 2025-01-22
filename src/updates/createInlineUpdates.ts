import React from "react";
import fs from "fs";
import path from "path";
import os from "os";
import { Options, Updates } from "../main";

import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import addGTIdentifierToSyntaxTree from "../data-_gt/addGTIdentifierToSyntaxTree";
import {
  warnHasUnwrappedExpression,
  warnNoId,
  warnVariableProp,
} from "../console/warnings";
import { hashJsxChildren } from "generaltranslation/id";

function handleStringChild(
  child: string,
  index: number,
  childrenTypes: ("expression" | "text" | "element")[]
) {
  let result = child;
  if (index === 0) {
    result = result.trimStart();
  }
  if (index === childrenTypes.length - 1) {
    result = result.trimEnd();
  }
  result = (() => {
    let newResult = "";
    let newline = false;
    for (const char of result) {
      if (char === "\n") {
        newResult = newResult.trimEnd();
        newline = true;
        continue;
      }
      if (!newline) {
        newResult += char;
        continue;
      }
      if (char.trim() === "") continue;
      newResult += char;
      newline = false;
    }
    return newResult;
  })();
  result = result.replace(/\s+/g, " ");
  return result;
}

function isStaticExpression(expr: t.Expression | t.JSXEmptyExpression): {
  isStatic: boolean;
  value?: string;
} {
  // Handle empty expressions
  if (t.isJSXEmptyExpression(expr)) {
    return { isStatic: true, value: "" };
  }

  // Handle direct string literals
  if (t.isStringLiteral(expr)) {
    return { isStatic: true, value: expr.value };
  }

  // Handle template literals without expressions
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return { isStatic: true, value: expr.quasis[0].value.raw };
  }

  // Handle binary expressions (string concatenation)
  if (t.isBinaryExpression(expr)) {
    // Only handle string concatenation
    if (expr.operator !== "+") {
      return { isStatic: false };
    }

    // Type guard to ensure we only process Expression types
    if (t.isExpression(expr.left) && t.isExpression(expr.right)) {
      const left = isStaticExpression(expr.left);
      const right = isStaticExpression(expr.right);

      if (
        left.isStatic &&
        right.isStatic &&
        left.value !== undefined &&
        right.value !== undefined
      ) {
        return { isStatic: true, value: left.value + right.value };
      }
    }
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(expr)) {
    return isStaticExpression(expr.expression);
  }

  // Handle numeric literals by converting them to strings
  if (t.isNumericLiteral(expr)) {
    return { isStatic: true, value: String(expr.value) };
  }

  // Handle boolean literals by converting them to strings
  if (t.isBooleanLiteral(expr)) {
    return { isStatic: true, value: String(expr.value) };
  }

  // Handle null literal
  if (t.isNullLiteral(expr)) {
    return { isStatic: true, value: "null" };
  }

  // Not a static expression
  return { isStatic: false };
}

export default async function createInlineUpdates(
  options: Options
): Promise<{ updates: Updates; errors: string[] }> {
  const updates: Updates = [];

  const errors: string[] = [];

  // Use the provided app directory or default to the current directory
  const srcDirectory = options.src || ["./"];

  // Define the file extensions to look for
  const extensions = [".js", ".jsx", ".tsx"];

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
      if (item.startsWith(".")) continue;

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

  const files = srcDirectory.flatMap((dir) => getFiles(dir));

  // Declare which components are considered valid "variable containers"
  const variableComponents = ["Var", "DateTime", "Currency", "Num"];

  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");

    let ast;
    try {
      ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
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
        if (name.type === "JSXIdentifier" && name.name === "T") {
          const componentObj: any = { props: {} };

          // We'll track this flag to know if any unwrapped {variable} is found in children
          const unwrappedExpressions: string[] = [];

          // The buildJSXTree function that handles children recursion
          function buildJSXTree(node: any, isInsideVar = false): any {
            if (t.isJSXExpressionContainer(node) && !isInsideVar) {
              const expr = node.expression;
              const staticAnalysis = isStaticExpression(expr);
              if (
                staticAnalysis.isStatic &&
                staticAnalysis.value !== undefined
              ) {
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
            }

            // Updated JSX Text handling
            // JSX Text handling following React's rules
            if (t.isJSXText(node)) {
              let text = node.value;
              return text;
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
              const nextInsideVar = variableComponents.includes(typeName ?? "")
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
                      attrValue = buildJSXTree(
                        attr.value.expression,
                        nextInsideVar
                      );
                    }
                  }
                  props[attrName as any] = attrValue;
                } else if (t.isJSXSpreadAttribute(attr)) {
                  props["..."] = generate(attr.argument).code;
                }
              });

              const children = element.children.map((child) =>
                buildJSXTree(child, nextInsideVar)
              );

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
                .filter((child: any) => child !== null && child !== "");
              return {
                type: "",
                props: {
                  children: children.length === 1 ? children[0] : children,
                },
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
            if (typeof attrName !== "string") return;

            if (attr.value) {
              // If it's a plain string literal like id="hello"
              if (t.isStringLiteral(attr.value)) {
                componentObj.props[attrName] = attr.value.value;
              }
              // If it's an expression container like id={"hello"}, id={someVar}, etc.
              else if (t.isJSXExpressionContainer(attr.value)) {
                const expr = attr.value.expression;
                const code = generate(expr).code;

                // Only check for static expressions on id and context props
                if (attrName === "id" || attrName === "context") {
                  const staticAnalysis = isStaticExpression(expr);
                  if (!staticAnalysis.isStatic) {
                    errors.push(warnVariableProp(file, attrName, code));
                  }
                }

                // Store the value (for all props)
                componentObj.props[attrName] = code;
              }
            }
          });

          // Build and store the "children" / tree
          const initialTree = buildJSXTree(path.node).props.children;
          const handleChildrenWhitespace = (currentTree: any): any => {
            if (Array.isArray(currentTree)) {
              const childrenTypes: ("text" | "element" | "expression")[] =
                currentTree.map((child) => {
                  if (typeof child === "string") return "text";
                  if (typeof child === "object" && "expression" in child)
                    return "expression";
                  return "element";
                });
              const newChildren: any[] = [];
              currentTree.forEach((child, index) => {
                if (childrenTypes[index] === "text") {
                  const string = handleStringChild(child, index, childrenTypes);
                  if (string) newChildren.push(string);
                } else if (childrenTypes[index] === "expression") {
                  newChildren.push(child.result);
                } else {
                  newChildren.push(handleChildrenWhitespace(child));
                }
              });
              return newChildren.length === 1 ? newChildren[0] : newChildren;
            } else if (currentTree?.props?.children) {
              const currentTreeChildren = handleChildrenWhitespace(
                currentTree.props.children
              );
              return {
                ...currentTree,
                props: {
                  ...currentTree.props,
                  ...(currentTreeChildren && { children: currentTreeChildren }),
                },
              };
            } else if (
              typeof currentTree === "object" &&
              "expression" in currentTree === true
            ) {
              return currentTree.result;
            } else if (typeof currentTree === "string") {
              return handleStringChild(currentTree, 0, ["text"]);
            }
            return currentTree;
          };
          const whitespaceHandledTree = handleChildrenWhitespace(initialTree);

          const tree = addGTIdentifierToSyntaxTree(whitespaceHandledTree);

          componentObj.tree = tree.length === 1 ? tree[0] : tree;

          // Check the id ...
          const id = componentObj.props.id;
          // If user forgot to provide an `id`, warn
          if (!id) {
            errors.push(warnNoId(file));
          }
          // If we found an unwrapped expression, skip
          if (unwrappedExpressions.length > 0) {
            errors.push(
              warnHasUnwrappedExpression(file, id, unwrappedExpressions)
            );
          }

          if (errors.length > 0) return;

          // <T> is valid here
          // displayFoundTMessage(file, id);
          updates.push({
            type: "jsx",
            source: componentObj.tree,
            metadata: componentObj.props,
          });
        }
      },
    });
  }

  // Post-process to add a hash to each update
  await Promise.all(
    updates.map(async (update) => {
      const context = update.metadata.context;
      const hash = hashJsxChildren(
        context
          ? {
              source: update.source,
              context,
            }
          : { source: update.source }
      );
      update.metadata.hash = hash;
    })
  );

  return { updates, errors };
}
