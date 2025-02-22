import { NodePath } from '@babel/traverse';
import { Updates } from '../../types';
export declare const attributes: string[];
/**
 * For the following example code:
 * const tx = useGT();
 * tx('string to translate', { id: 'exampleId', context: 'exampleContext' });
 *
 * This function will find all call expressions of useGT(), then find all call expressions
 * of the subsequent tx() calls, and append the content and metadata to the updates array.
 */
export declare function parseStrings(importName: string, path: NodePath, updates: Updates, errors: string[], file: string): void;
