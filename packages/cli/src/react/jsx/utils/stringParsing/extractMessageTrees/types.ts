import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import type { ParsingConfig, ParsingOutput } from '../types.js';

export type TreeContext = {
  /** Path whose scope resolves identifiers in the current template. */
  scopePath: NodePath;
  config: ParsingConfig;
  output: ParsingOutput;
  usesDerive: boolean;
  resolvingParts: Set<t.Node>;
};

export type TagOptions = t.CallExpression['arguments'];
