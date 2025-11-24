// ===== Tree Construction ===== //
// Used for parseDeclareStatic.ts
type Node = TextNode | SequenceNode | ChoiceNode;

type TextNode = {
  type: 'text';
  text: string;
};

type SequenceNode = {
  type: 'sequence';
  nodes: Node[];
};

type ChoiceNode = {
  type: 'choice';
  nodes: Node[];
};

export type { Node, TextNode, SequenceNode, ChoiceNode };
