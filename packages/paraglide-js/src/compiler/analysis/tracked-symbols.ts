import type { SymbolSpec } from '../paraglide/targets.js';
import type { TrackedSymbol } from './types.js';

export function symbolFromSpec(
  spec: SymbolSpec,
  target: string,
  file: string
): TrackedSymbol {
  if (spec.type === 'value') {
    return {
      type: 'value',
      target,
      name: spec.name,
      methods: spec.methods ?? [],
      file,
    };
  }

  return {
    type: 'namespace',
    member: (name) => {
      const member = spec.member(name);
      return member && symbolFromSpec(member, target, file);
    },
  };
}
