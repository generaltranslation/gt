import type * as t from '@babel/types';

/** Thrown when a message cannot be extracted statically; the message is skipped. */
export class NonStaticMessageError extends Error {
  constructor(
    reason: string,
    readonly node: t.Node,
    readonly details?: string,
    readonly fix?: string
  ) {
    super(reason);
  }
}

export function formatLocation(node: t.Node): string | undefined {
  const start = node.loc?.start;
  return start ? `${start.line}:${start.column}` : undefined;
}
