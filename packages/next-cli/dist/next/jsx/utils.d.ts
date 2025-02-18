import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
export declare function isHtmlElement(element: t.JSXOpeningElement): boolean;
export declare function isBodyElement(element: t.JSXOpeningElement): boolean;
export declare function hasGTProviderChild(children: t.JSXElement['children']): boolean;
export declare function addDynamicLangAttribute(element: t.JSXOpeningElement): void;
export declare function makeParentFunctionAsync(path: NodePath): boolean;
