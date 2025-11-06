// ===== Tree Construction ===== //
type MultiplicationNode = {
  nodeType: 'multiplication';
  branches: (JsxTree | MultiplicationNode)[];
};

type ExpressionNode = {
  nodeType: 'expression';
  result: string | number | MultiplicationNode | null;
};

// TODO: have some sort of type identifier field here that is Multiplication | Expression | Element
type ElementNode = {
  nodeType: 'element';
  type: string;
  props?: {
    children?: JsxTree | MultiplicationNode | (JsxTree | MultiplicationNode)[];
    [key: string]: any;
  };
};
type JsxTree = ElementNode | ExpressionNode | string | number | null;

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
  props?: {
    children?: (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[];
    // Other attributess
    [key: string]: any;
  };
};
type WhitespaceJsxTreeResult = WhitespaceJsxTree | string | number | null;

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
type MultipliedTreeNode = MultipliedTree | string | number | null;

export type { MultipliedTree, MultipliedTreeNode };
