import { describe, expect, it } from 'vitest';
import { multiply } from '../multiply';
import type { ChoiceNode, ResolutionNode } from '../types';

function choice<T>(branches: ResolutionNode<T>[]): ChoiceNode<T> {
  return {
    __gt_node_type: 'choice',
    branches,
  };
}

describe('multiply', () => {
  it('returns one empty variant for empty input', () => {
    expect(multiply<string>([])).toEqual([[]]);
  });

  it('returns one variant when there are no choices', () => {
    expect(multiply(['Hello', ' ', 'World'])).toEqual([
      ['Hello', ' ', 'World'],
    ]);
  });

  it('expands a single choice node', () => {
    const nodes: ResolutionNode<string>[] = [
      'Hello ',
      choice(['day', 'night']),
    ];

    expect(multiply(nodes)).toEqual([
      ['Hello ', 'day'],
      ['Hello ', 'night'],
    ]);
  });

  it('expands multiple choice nodes as a cross product', () => {
    const nodes: ResolutionNode<string>[] = [
      choice(['Good ', 'Bad ']),
      choice(['morning', 'evening']),
    ];

    expect(multiply(nodes)).toEqual([
      ['Good ', 'morning'],
      ['Good ', 'evening'],
      ['Bad ', 'morning'],
      ['Bad ', 'evening'],
    ]);
  });

  it('flattens nested choice nodes into alternatives', () => {
    const nodes: ResolutionNode<string>[] = [
      'prefix ',
      choice([choice(['A', 'B']), 'C']),
      ' suffix',
    ];

    expect(multiply(nodes)).toEqual([
      ['prefix ', 'A', ' suffix'],
      ['prefix ', 'B', ' suffix'],
      ['prefix ', 'C', ' suffix'],
    ]);
  });

  it('returns no variants when any choice has no branches', () => {
    const nodes: ResolutionNode<string>[] = ['before', choice([]), 'after'];

    expect(multiply(nodes)).toEqual([]);
  });
});
