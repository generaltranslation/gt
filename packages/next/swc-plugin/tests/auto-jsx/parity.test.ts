import { beforeAll, describe, expect, it } from 'vitest';
import { canonical, lower, oracle } from './oracle';
import { cliResult } from './cli-oracle';
import { classifyCliDivergences } from './cli-divergences';
import {
  buildNativeDriver,
  loadExamples,
  readExample,
  readCorpus,
  runNative,
  yieldToRunner,
} from './workflow';

const examples = await loadExamples();
let outputs: string[];
let disabledOutputs: string[];
it('keeps the golden corpus in sync with the complete generator set', async () => {
  expect(Object.keys(await readCorpus()).sort()).toEqual(
    examples.map(({ name }) => name).sort()
  );
});
beforeAll(async () => {
  await buildNativeDriver();
  const inputs = examples.map(({ input }) => input);
  [outputs, disabledOutputs] = await Promise.all([
    runNative(inputs),
    runNative(inputs, {
      enableAutoJsxInjection: false,
      compileTimeHash: false,
    }),
  ]);
}, 300_000);

describe('SWC auto JSX matches the isolated compiler insertion pass', () => {
  for (const [index, example] of examples.entries()) {
    it(example.name, async () => {
      await yieldToRunner(index);
      const checked = await readExample(example);
      expect(checked.input.trim()).toBe(example.input.trim());
      expect(
        canonical(lower(disabledOutputs[index])),
        'native SWC preserves input with injection and hashing disabled'
      ).toBe(canonical(lower(example.input)));
      const expected = canonical(oracle(example.input));
      const cli = cliResult(example.input);
      expect(
        cli.output,
        'checked-in CLI output matches the live CLI insertion pass'
      ).toBe(checked.cliOutput);
      if (checked.cliDivergences.length === 0) {
        expect(
          cli.canonical,
          'the independent CLI oracle agrees with the compiler'
        ).toBe(expected);
      } else {
        expect(
          cli.canonical,
          'a recorded CLI divergence still exists'
        ).not.toBe(expected);
        expect(
          classifyCliDivergences(example.input),
          'the CLI divergence has reviewed source-specific reasons'
        ).toEqual(checked.cliDivergences);
      }
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

it('detects a missing translation or variable wrapper instead of normalizing it away', () => {
  expect(canonical(lower('<div>Hello {name}</div>'))).not.toBe(
    canonical(oracle('<div>Hello {name}</div>'))
  );
  expect(canonical(oracle('<div>Hello {first}{second}</div>'))).not.toBe(
    canonical(oracle('<div>Hello {first + second}</div>'))
  );
});
