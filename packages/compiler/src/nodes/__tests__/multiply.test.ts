import { describe, it, expect } from 'vitest';
import { multiply, cartesianProduct } from '../multiply';
import {
  containsChoiceNode,
  findChoiceNodes,
  recurseIntoExtractionChild,
} from '../traversal';
import {
  createChoiceNode,
  createExtractionElement,
  createExtractionGTProp,
} from '../factory';
import { isChoiceNode } from '../guards';
import type { ResolutionNode, ExtractionChild } from '../types';

// ─────────────────────────────────────────────────
// cartesianProduct
// ─────────────────────────────────────────────────

describe('cartesianProduct', () => {
  it('returns [[]] for empty input', () => {
    expect(cartesianProduct([])).toEqual([[]]);
  });

  it('returns each element as a singleton for a single array', () => {
    expect(cartesianProduct([['a', 'b']])).toEqual([['a'], ['b']]);
  });

  it('computes cross-product of two arrays', () => {
    const result = cartesianProduct([
      ['a', 'b'],
      ['x', 'y'],
    ]);
    expect(result).toEqual([
      ['a', 'x'],
      ['a', 'y'],
      ['b', 'x'],
      ['b', 'y'],
    ]);
  });

  it('computes cross-product of three arrays', () => {
    const result = cartesianProduct([['a', 'b'], ['x'], ['1', '2']]);
    expect(result).toEqual([
      ['a', 'x', '1'],
      ['a', 'x', '2'],
      ['b', 'x', '1'],
      ['b', 'x', '2'],
    ]);
  });

  it('handles singleton arrays (no expansion)', () => {
    const result = cartesianProduct([['a'], ['b'], ['c']]);
    expect(result).toEqual([['a', 'b', 'c']]);
  });

  it('handles a single empty array producing no results', () => {
    const result = cartesianProduct([['a', 'b'], []]);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────
// multiply — strings (no recurseIntoLeaf)
// ─────────────────────────────────────────────────

describe('multiply<string>', () => {
  it('returns single variant when no choices present', () => {
    const nodes: ResolutionNode<string>[] = ['Hello', ' ', 'World'];
    const result = multiply(nodes);
    expect(result).toEqual([['Hello', ' ', 'World']]);
  });

  it('returns empty outer array for empty input', () => {
    const result = multiply<string>([]);
    expect(result).toEqual([[]]);
  });

  it('expands a single choice node', () => {
    const nodes: ResolutionNode<string>[] = [
      'Hello ',
      createChoiceNode(['day', 'night']),
    ];
    const result = multiply(nodes);
    expect(result).toEqual([
      ['Hello ', 'day'],
      ['Hello ', 'night'],
    ]);
  });

  it('expands two choice nodes (cross-product)', () => {
    const nodes: ResolutionNode<string>[] = [
      createChoiceNode(['Good ', 'Bad ']),
      createChoiceNode(['morning', 'evening']),
    ];
    const result = multiply(nodes);
    expect(result).toEqual([
      ['Good ', 'morning'],
      ['Good ', 'evening'],
      ['Bad ', 'morning'],
      ['Bad ', 'evening'],
    ]);
  });

  it('handles choice with single branch (no expansion)', () => {
    const nodes: ResolutionNode<string>[] = [
      'prefix-',
      createChoiceNode(['only']),
    ];
    const result = multiply(nodes);
    expect(result).toEqual([['prefix-', 'only']]);
  });

  it('handles choice with three branches', () => {
    const nodes: ResolutionNode<string>[] = [createChoiceNode(['a', 'b', 'c'])];
    const result = multiply(nodes);
    expect(result).toEqual([['a'], ['b'], ['c']]);
  });

  it('handles mixed strings and choices', () => {
    const nodes: ResolutionNode<string>[] = [
      'prefix ',
      createChoiceNode(['A', 'B']),
      ' suffix',
    ];
    const result = multiply(nodes);
    expect(result).toEqual([
      ['prefix ', 'A', ' suffix'],
      ['prefix ', 'B', ' suffix'],
    ]);
  });

  it('expands nested choice nodes (choice within choice)', () => {
    const inner = createChoiceNode(['x', 'y']);
    const outer = createChoiceNode<string>([inner, 'z']);
    const nodes: ResolutionNode<string>[] = [outer];
    const result = multiply(nodes);
    expect(result).toEqual([['x'], ['y'], ['z']]);
  });

  it('produces correct count for 3x2 cross-product', () => {
    const nodes: ResolutionNode<string>[] = [
      createChoiceNode(['a', 'b', 'c']),
      createChoiceNode(['1', '2']),
    ];
    const result = multiply(nodes);
    expect(result).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────────
// multiply — JSX ExtractionChild (with recurseIntoLeaf)
// ─────────────────────────────────────────────────

describe('multiply<ExtractionChild>', () => {
  it('returns single variant for plain string children', () => {
    const nodes: ResolutionNode<ExtractionChild>[] = ['Hello', 'World'];
    const result = multiply(nodes, recurseIntoExtractionChild);
    expect(result).toEqual([['Hello', 'World']]);
  });

  it('returns single variant for elements with no choices', () => {
    const elem = createExtractionElement('div', 1, ['text']);
    const nodes: ResolutionNode<ExtractionChild>[] = [elem];
    const result = multiply(nodes, recurseIntoExtractionChild);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe(elem);
  });

  it('expands top-level choice with ExtractionChild branches', () => {
    const nodes: ResolutionNode<ExtractionChild>[] = [
      createChoiceNode<ExtractionChild>(['Hello', 'Goodbye']),
      ' World',
    ];
    const result = multiply(nodes, recurseIntoExtractionChild);
    expect(result).toEqual([
      ['Hello', ' World'],
      ['Goodbye', ' World'],
    ]);
  });
});

// ─────────────────────────────────────────────────
// containsChoiceNode
// ─────────────────────────────────────────────────

describe('containsChoiceNode', () => {
  it('returns false for plain strings', () => {
    const nodes: ResolutionNode<string>[] = ['a', 'b'];
    expect(containsChoiceNode(nodes)).toBe(false);
  });

  it('returns true for top-level choice', () => {
    const nodes: ResolutionNode<string>[] = ['a', createChoiceNode(['x', 'y'])];
    expect(containsChoiceNode(nodes)).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(containsChoiceNode([])).toBe(false);
  });

  it('detects choice nested in ExtractionElement children', () => {
    const choice = createChoiceNode<ExtractionChild>(['a', 'b']);
    const elem = createExtractionElement('div', 1, [choice]);
    const nodes: ResolutionNode<ExtractionChild>[] = [elem];
    expect(containsChoiceNode(nodes, recurseIntoExtractionChild)).toBe(true);
  });

  it('returns false for ExtractionElement with no choices', () => {
    const elem = createExtractionElement('div', 1, ['text']);
    const nodes: ResolutionNode<ExtractionChild>[] = [elem];
    expect(containsChoiceNode(nodes, recurseIntoExtractionChild)).toBe(false);
  });
});

// ─────────────────────────────────────────────────
// findChoiceNodes
// ─────────────────────────────────────────────────

describe('findChoiceNodes', () => {
  it('returns empty array for no choices', () => {
    const nodes: ResolutionNode<string>[] = ['a', 'b'];
    expect(findChoiceNodes(nodes)).toEqual([]);
  });

  it('finds top-level choice nodes', () => {
    const choice = createChoiceNode(['x', 'y']);
    const nodes: ResolutionNode<string>[] = ['a', choice];
    const found = findChoiceNodes(nodes);
    expect(found).toHaveLength(1);
    expect(found[0].node).toBe(choice);
    expect(found[0].path).toBe('[1]');
  });

  it('finds multiple choice nodes', () => {
    const c1 = createChoiceNode(['a', 'b']);
    const c2 = createChoiceNode(['x', 'y']);
    const nodes: ResolutionNode<string>[] = [c1, 'text', c2];
    const found = findChoiceNodes(nodes);
    expect(found).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────
// isChoiceNode guard
// ─────────────────────────────────────────────────

describe('isChoiceNode', () => {
  it('returns true for ChoiceNode', () => {
    expect(isChoiceNode(createChoiceNode(['a', 'b']))).toBe(true);
  });

  it('returns false for string', () => {
    expect(isChoiceNode('hello')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isChoiceNode(null as unknown as ResolutionNode<string>)).toBe(false);
  });

  it('returns false for object without discriminator', () => {
    expect(
      isChoiceNode({ branches: ['a'] } as unknown as ResolutionNode<string>)
    ).toBe(false);
  });

  it('returns false for object with wrong discriminator', () => {
    expect(
      isChoiceNode({
        __gt_node_type: 'other',
      } as unknown as ResolutionNode<string>)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────
// recurseIntoExtractionChild
// ─────────────────────────────────────────────────

describe('recurseIntoExtractionChild', () => {
  it('returns null for string leaf', () => {
    expect(recurseIntoExtractionChild('hello')).toBeNull();
  });

  it('returns children for ExtractionElement with children', () => {
    const elem = createExtractionElement('div', 1, ['a', 'b']);
    expect(recurseIntoExtractionChild(elem)).toEqual(['a', 'b']);
  });

  it('returns null for ExtractionElement without children or data', () => {
    const elem = createExtractionElement('div', 1);
    expect(recurseIntoExtractionChild(elem)).toBeNull();
  });

  it('returns GTProp branch children for ExtractionElement with data', () => {
    const data = createExtractionGTProp({ one: ['text1'], other: ['text2'] });
    const elem = createExtractionElement('span', 2, undefined, data);
    const result = recurseIntoExtractionChild(elem);
    expect(result).toBeTruthy();
    expect(result).toContain('text1');
    expect(result).toContain('text2');
  });
});
