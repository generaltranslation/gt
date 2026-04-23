import * as t from '@babel/types';
import type {
  HtmlContentPropKeysRecord,
  Variable,
} from 'generaltranslation/types';

// ===== Core Node Types ===== //

/**
 * A node representing a choice between alternatives.
 * Produced by derive resolution when a derive expression
 * resolves to multiple possible values (e.g., conditional returns,
 * multiple branches).
 *
 * The multiplication utility expands all ChoiceNodes in a tree
 * into the cross-product of all possible combinations.
 *
 * @typeParam T - The leaf content type (e.g., `string` or `ExtractionChild`)
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

// ===== JSX Extraction Types ===== //

/**
 * Mirrors core's `JsxChild` but uses `ExtractionElement` instead of
 * `JsxElement`, allowing `ChoiceNode`s in the tree during extraction.
 *
 * After multiplication removes all `ChoiceNode`s, this collapses
 * back to `JsxChild`.
 */
export type ExtractionChild = string | ExtractionElement | Variable;

/**
 * Mirrors core's `JsxElement` but allows `ResolutionNode` wrappers
 * at every position where children can appear.
 *
 * - `c` (children) is `ResolutionNode<ExtractionChild>[]` instead of `JsxChildren`
 * - `d` (GT data) is `ExtractionGTProp` instead of `GTProp`
 * - `__gt_type` discriminator tag for easy identification during traversal
 *
 * After multiplication, collapses to `JsxElement`.
 */
export type ExtractionElement = {
  __gt_type: 'element';
  t?: string;
  i?: number;
  d?: ExtractionGTProp;
  c?: ResolutionNode<ExtractionChild>[];
};

/**
 * Mirrors core's `GTProp` but allows `ResolutionNode` wrappers
 * in branch values.
 *
 * - `b` (branches) values are `ResolutionNode<ExtractionChild>[]`
 *   instead of `JsxChildren`
 * - `__gt_type` discriminator tag for easy identification during traversal
 *
 * After multiplication, collapses to `GTProp`.
 */
export type ExtractionGTProp = {
  __gt_type: 'gt_prop';
  b?: Record<string, ResolutionNode<ExtractionChild>[]>;
  t?: 'p' | 'b';
} & HtmlContentPropKeysRecord;

// ===== String Extraction Types ===== //

/**
 * Extraction units
 */
export type StringPart =
  | { type: 'static'; content: string }
  | { type: 'derive'; content: t.Expression }
  | { type: 'dynamic'; content: t.Expression };
