import type { SymbolSpec } from '../paraglide/targets.js';
import type { TrackedSymbol } from './types.js';

export function symbolFromSpec(
  spec: SymbolSpec,
  target: string,
  via: string[]
): TrackedSymbol {
  if (spec.type === 'value') {
    return {
      type: 'value',
      target,
      name: spec.name,
      methods: spec.methods ?? [],
      via,
    };
  }

  return {
    type: 'namespace',
    member: (name) => {
      const member = spec.member(name);
      return member && symbolFromSpec(member, target, via);
    },
  };
}

/** Records that a symbol was reached through the module `file`. */
export function prependVia(file: string, symbol: TrackedSymbol): TrackedSymbol {
  if (symbol.type === 'value') {
    return { ...symbol, via: [file, ...symbol.via] };
  }

  return {
    type: 'namespace',
    member: (name) => {
      const member = symbol.member(name);
      return member && prependVia(file, member);
    },
  };
}
