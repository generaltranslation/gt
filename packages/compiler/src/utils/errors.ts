import * as t from '@babel/types';

/**
 * Create error location with filename and line number
 * @param node
 */
export function createErrorLocation(node: t.Node) {
  if (node.loc?.start.line) {
    if (node.loc?.start.column) {
      return ` {filename}:${node.loc.start.line}:${node.loc.start.column}`;
    }
    return ` {filename}:${node.loc.start.line}`;
  }
  return ` {filename}`;
}

const T_COMPONENT_DYNAMIC_CONTENT_ERROR =
  'The <T> component cannot contain any dynamic content. ';

export function generateDynamicContentErrorMessage(name?: string) {
  return (
    T_COMPONENT_DYNAMIC_CONTENT_ERROR +
    (name
      ? `Wrap the "${name}" variable in a <Var> component.`
      : 'All variables must be wrapped in a <Var> component or other Variable Components.')
  );
}
