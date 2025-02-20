import * as t from '@babel/types';
import { ImportItem } from './parse/parseAst';
/**
 * Recursively wraps a JSX element with a <T> component and unique id
 * @param node - The JSX element to wrap
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param options - Optional component names for T and Var
 */
export interface WrapResult {
    node: t.JSXElement;
    hasMeaningfulContent: boolean;
}
/**
 * Recursively traverse a JSX element and wrap variables with a <Var> component
 * @param node - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
export declare function wrapJsxElement(node: t.JSXElement, options: {
    createIds: boolean;
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: ImportItem[];
    modified: boolean;
    warnings: string[];
    file: string;
}, isMeaningful: (node: t.Node) => boolean, mark: boolean): WrapResult;
/**
 * Wraps a JSX element with a <T> component and unique id
 * @param rootNode - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
export declare function handleJsxElement(rootNode: t.JSXElement, options: {
    createIds: boolean;
    usedImports: ImportItem[];
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    modified: boolean;
    warnings: string[];
    file: string;
}, isMeaningful: (node: t.Node) => boolean): WrapResult;
