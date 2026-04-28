/**
 * A node representing a choice between alternatives.
 * Produced by derive resolution when a derive expression
 * resolves to multiple possible values (e.g., conditional returns,
 * multiple branches).
 *
 * The multiplication utility expands all ChoiceNodes in a tree
 * into the cross-product of all possible combinations.
 *
 * @typeParam T - The leaf content type
 */
export type ChoiceNode<T> = {
  __gt_node_type: 'choice';
  branches: ResolutionNode<T>[];
};

/**
 * A node in the resolution tree. Either a leaf value of type T,
 * or a ChoiceNode representing alternatives.
 *
 * Arrays of ResolutionNode<T> represent sequences (ordered content).
 * ChoiceNode<T> represents branching (pick one alternative).
 *
 * @typeParam T - The leaf content type
 */
export type ResolutionNode<T> = T | ChoiceNode<T>;
