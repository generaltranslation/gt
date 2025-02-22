import { Updates } from '../types';
import * as t from '@babel/types';
/**
 * Builds a JSX tree from a given node, recursively handling children.
 * @param node - The node to build the tree from
 * @param unwrappedExpressions - An array to store unwrapped expressions
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @returns The built JSX tree
 */
export declare function buildJSXTree(importAliases: Record<string, string>, node: any, unwrappedExpressions: string[], updates: Updates, errors: string[], file: string): any;
export declare function parseJSXElement(importAliases: Record<string, string>, node: t.JSXElement, updates: Updates, errors: string[], file: string): void;
