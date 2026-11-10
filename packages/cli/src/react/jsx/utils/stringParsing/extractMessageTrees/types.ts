import type * as t from '@babel/types';
import type { ParsingConfig, ParsingOutput } from '../types.js';

export type TreeContext = {
  config: ParsingConfig;
  output: ParsingOutput;
  usesDerive: boolean;
  resolvingParts: Set<t.Node>;
};

export type TagOptions = t.CallExpression['arguments'];
