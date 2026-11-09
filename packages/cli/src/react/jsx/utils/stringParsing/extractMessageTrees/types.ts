import type * as t from '@babel/types';
import type { ParsingConfig, ParsingOutput } from '../types.js';

export type TreeContext = {
  config: ParsingConfig;
  output: ParsingOutput;
  usesDerive: boolean;
  resolvingParts: Set<t.Node>;
  /**
   * Each named format's literal Intl options, with the formatting-context
   * keys it sets to an expression.
   */
  namedFormats: {
    name: string;
    options: Record<string, unknown>;
    dynamicKeys: string[];
  }[];
};

export type TagOptions = t.CallExpression['arguments'];
