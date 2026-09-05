import { beforeAll, describe, expect, it } from 'vitest';
import { canonical, lower, oracle } from './oracle';
import {
  buildNativeDriver,
  loadExamples,
  readExample,
  readCorpus,
  runNative,
} from './workflow';

const examples = await loadExamples();
let outputs: string[];
it('keeps the golden corpus in sync with the complete generator set', async () => {
  expect(Object.keys(await readCorpus()).sort()).toEqual(
    examples.map(({ name }) => name).sort()
  );
});
beforeAll(() => {
  buildNativeDriver();
  outputs = runNative(examples.map(({ input }) => input));
}, 300_000);

describe('SWC auto JSX matches the isolated compiler insertion pass', () => {
  for (const [index, example] of examples.entries()) {
    it(example.name, async () => {
      const checked = await readExample(example);
      expect(checked.input.trim()).toBe(example.input.trim());
      const expected = canonical(oracle(example.input));
      expect(
        canonical(lower(checked.output)),
        'checked-in output matches the live compiler'
      ).toBe(expected);
      expect(
        canonical(lower(outputs[index])),
        'native SWC matches the live compiler'
      ).toBe(expected);
      expect(
        canonical(oracle(example.input, true)),
        'development and production compiler semantics agree'
      ).toBe(expected);
    });
  }
});

it('keeps the entire corpus unchanged with auto JSX disabled and hashing disabled', () => {
  const disabled = runNative(
    examples.map(({ input }) => input),
    { enableAutoJsxInjection: false, compileTimeHash: false }
  );
  for (const [index, example] of examples.entries()) {
    expect(canonical(lower(disabled[index])), example.name).toBe(
      canonical(lower(example.input))
    );
  }
}, 120_000);

it('detects a missing translation or variable wrapper instead of normalizing it away', () => {
  expect(canonical(lower('<div>Hello {name}</div>'))).not.toBe(
    canonical(oracle('<div>Hello {name}</div>'))
  );
  expect(canonical(oracle('<div>Hello {first}{second}</div>'))).not.toBe(
    canonical(oracle('<div>Hello {first + second}</div>'))
  );
});
