// ===== Tree Construction ===== //
// Used for derive / declare_var parsing

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

/**
 * Converts a StringNode tree into all possible string variants.
 * - TextNode → single string
 * - SequenceNode → cartesian product of all parts
 * - ChoiceNode → flattened branches (deduplicated)
 */
export function nodeToStrings(node: StringNode | null): string[] {
  if (node === null) {
    return [];
  }

  if (node.type === 'text') {
    return [node.text];
  }

  if (node.type === 'sequence') {
    const partResults: string[][] = node.nodes.map((n) => nodeToStrings(n));
    return cartesianProduct(partResults);
  }

  if (node.type === 'choice') {
    const allStrings: string[] = [];
    for (const branch of node.nodes) {
      allStrings.push(...nodeToStrings(branch));
    }
    return [...new Set(allStrings)]; // Deduplicate
  }

  return [];
}

/**
 * Creates cartesian product of string arrays and concatenates them.
 * @example cartesianProduct([["Hello "], ["day", "night"]]) → ["Hello day", "Hello night"]
 */
function cartesianProduct(arrays: string[][]): string[] {
  if (arrays.length === 0) {
    return [];
  }

  if (arrays.length === 1) {
    return arrays[0];
  }

  let result = arrays[0];

  for (let i = 1; i < arrays.length; i++) {
    const newResult: string[] = [];
    for (const prev of result) {
      for (const curr of arrays[i]) {
        newResult.push(prev + curr);
      }
    }
    result = newResult;
  }

  return result;
}
