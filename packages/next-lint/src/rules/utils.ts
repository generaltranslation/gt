const GT_MODULES = ['gt-next', 'gt-next/client', 'gt-next/server'];

export type AstNode = {
  type: string;
  [key: string]: unknown;
};

export function isAstNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export function getNodeName(value: unknown): string | null {
  return isAstNode(value) && typeof value.name === 'string' ? value.name : null;
}

export function isGTModule(source: string): boolean {
  return GT_MODULES.includes(source);
}

export function isStringLiteral(node: unknown): boolean {
  if (!isAstNode(node)) return false;
  return (
    (node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'TemplateLiteral' &&
      Array.isArray(node.expressions) &&
      node.expressions.length === 0)
  );
}
