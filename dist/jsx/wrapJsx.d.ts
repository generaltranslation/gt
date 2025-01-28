import * as t from '@babel/types';
/**
 * Recursively wraps a JSX element with a <T> component and unique id
 * @param node - The JSX element to wrap
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param options - Optional component names for T and Var
 */
export interface WrapResult {
    node: t.JSXElement | t.JSXExpressionContainer;
    needsWrapping: boolean;
}
/**
 * Recursively traverse a JSX element and wrap variables with a <Var> component
 * @param node - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
export declare function wrapJsxElement(node: t.JSXElement | t.JSXExpressionContainer, options: {
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: string[];
}, isMeaningful: (node: t.Node) => boolean): WrapResult;
/**
 * Wraps a JSX element with a <T> component and unique id
 * @param rootNode - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
export declare function handleJsxElement(rootNode: t.JSXElement | t.JSXExpressionContainer, options: {
    usedImports: string[];
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
}, isMeaningful: (node: t.Node) => boolean): t.JSXElement | t.JSXExpressionContainer;
