import * as t from '@babel/types';
import { ParseResult } from '@babel/parser';
export declare function determineModuleType(ast: ParseResult<t.File>): boolean;
export declare function generateImports(needsImport: string[], isESM: boolean, importMap: Record<string, {
    name: string;
    source: string;
}>): (t.ImportDeclaration | t.VariableDeclaration)[];
export declare function generateImportMap(ast: ParseResult<t.File>, framework: string): {
    initialImports: string[];
    importAlias: {
        TComponent: string;
        VarComponent: string;
    };
};
export declare function insertImports(ast: ParseResult<t.File>, importNodes: (t.ImportDeclaration | t.VariableDeclaration)[]): void;
export declare function createImports(ast: ParseResult<t.File>, needsImport: string[], importMap: Record<string, {
    name: string;
    source: string;
}>): void;
