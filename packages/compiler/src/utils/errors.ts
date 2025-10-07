import * as t from '@babel/types';

/**
 * Create error location with filename and line number
 * @param node
 */
export function createErrorLocation(node: t.Node) {
  if (node.loc?.start.line) {
    if (node.loc?.start.column) {
      return `{filename}:${node.loc.start.line}:${node.loc.start.column}`;
    }
    return `{filename}:${node.loc.start.line}`;
  }
  return `{filename}`;
}
