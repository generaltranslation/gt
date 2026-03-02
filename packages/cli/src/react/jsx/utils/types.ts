// ===== Tree Construction ===== //
// Used for parseDerive.ts
type StringNode = StringTextNode | StringSequenceNode | StringChoiceNode;

type StringTextNode = {
  type: 'text';
  text: string;
};

type StringSequenceNode = {
  type: 'sequence';
  nodes: StringNode[];
};

type StringChoiceNode = {
  type: 'choice';
  nodes: StringNode[];
};

export type {
  StringNode,
  StringTextNode,
  StringSequenceNode,
  StringChoiceNode,
};
