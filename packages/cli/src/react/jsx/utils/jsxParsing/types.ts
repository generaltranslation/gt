// ===== Tree Construction ===== //
type MultiplicationNode = {
  nodeType: 'multiplication';
  branches: (JsxTree | MultiplicationNode)[];
};

type ExpressionNode = {
  nodeType: 'expression';
  result: string | number | boolean | MultiplicationNode | null;
};

// TODO: have some sort of type identifier field here that is Multiplication | Expression | Element
type ElementNode = {
  nodeType: 'element';
  type: string;
  /**
   * Set when an enclosing scope rebinds the tag name, so the element renders
   * that binding rather than the GT component of the same name. The tag name
   * stays in `type` to match the runtime hash, but no GT props are derived.
   */
  shadowed?: true;
  /**
   * The GT variable component this tag rendered at its own binding. Carried so
   * the identifier pass reads the tag's binding instead of the file-level alias
   * map, which cannot tell two same-named bindings apart.
   */
  variableType?: string;
  props?: {
    children?: JsxTree | MultiplicationNode | (JsxTree | MultiplicationNode)[];
    [key: string]: unknown;
  };
};
type JsxTree = ElementNode | ExpressionNode | string | number | boolean | null;

export type { MultiplicationNode, ExpressionNode, ElementNode, JsxTree };

// ----- Helpers ----- //

function isElementNode(
  node: JsxTree | MultiplicationNode
): node is ElementNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 'element'
  );
}

function isExpressionNode(
  node: JsxTree | MultiplicationNode
): node is ExpressionNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 'expression'
  );
}

function isMultiplicationNode(
  node: JsxTree | MultiplicationNode
): node is MultiplicationNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 'multiplication'
  );
}

export { isElementNode, isExpressionNode, isMultiplicationNode };

// ===== Whitespace Handling ===== //
type WhitespaceMultiplicationNode = {
  nodeType: 'multiplication';
  branches: (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[];
};

type WhitespaceJsxTree = {
  nodeType?: 'element';
  type: string;
  /** Carried through the whitespace and multiplication passes; see ElementNode. */
  shadowed?: true;
  /** Carried through the whitespace and multiplication passes; see ElementNode. */
  variableType?: string;
  props?: {
    children?: (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[];
    // Other attributess
    [key: string]: unknown;
  };
};
type WhitespaceJsxTreeResult =
  | WhitespaceJsxTree
  | string
  | number
  | boolean
  | null;

export type {
  WhitespaceMultiplicationNode,
  WhitespaceJsxTree,
  WhitespaceJsxTreeResult,
};

// ----- Helpers ----- //

function isWhitespaceJsxTree(
  node: WhitespaceJsxTreeResult | WhitespaceMultiplicationNode
): node is WhitespaceJsxTree {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 'element'
  );
}

function isWhitespaceMultiplicationNode(
  node: WhitespaceJsxTreeResult | WhitespaceMultiplicationNode
): node is WhitespaceMultiplicationNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 'multiplication'
  );
}

export { isWhitespaceJsxTree, isWhitespaceMultiplicationNode };

// ===== Multiplied Tree ===== //

// No multiplication nodes
type MultipliedTree = {
  nodeType?: 'element';
  type: string;
  props?: {
    children?: MultipliedTreeNode;
  };
};
type MultipliedTreeNode = MultipliedTree | string | number | boolean | null;

export type { MultipliedTree, MultipliedTreeNode };
