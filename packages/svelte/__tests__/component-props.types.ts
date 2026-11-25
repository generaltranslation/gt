import type { ComponentProps } from 'svelte';
import type RelativeTime from '../src/components/RelativeTime.svelte';
import type T from '../src/components/T.svelte';
import type {
  BranchSnippet,
  ElementSnippet,
  VariableSnippet,
} from '../src/runtime/nodes';

export const relativeTimeProps: ComponentProps<typeof RelativeTime>[] = [
  {},
  { value: null },
  { value: new Date(), baseDate: new Date() },
  { value: 3, unit: 'day', options: { numeric: 'auto' } },
  // @ts-expect-error A numeric value needs a unit.
  { value: 3 },
];

declare const elementSnippet: ElementSnippet;
declare const branchSnippet: BranchSnippet;
declare const variableSnippet: VariableSnippet;

export const tProps: ComponentProps<typeof T>[] = [
  { context: 'button', id: 'save', maxChars: 10, requiresReview: true },
  {
    __gt_e_1: elementSnippet,
    __gt_e_2: branchSnippet,
    __gt_v_b2_0$3: variableSnippet,
  },
  // @ts-expect-error A misspelled prop is not a generated snippet.
  { contex: 'button' },
  // @ts-expect-error A generated variable snippet takes no arguments.
  { __gt_v_1: elementSnippet },
];
