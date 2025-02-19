import { NodePath } from '@babel/traverse';
import { ImportDeclaration, VariableDeclaration } from '@babel/types';
import { Updates } from '../../types';
export declare function parseStrings(path: NodePath<ImportDeclaration | VariableDeclaration>, updates: Updates, errors: string[], file: string, pkg: 'gt-react' | 'gt-next'): void;
