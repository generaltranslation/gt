import { beforeAll, describe, expect, it } from 'vitest';
import {
  canonical,
  canonicalRuntime,
  hasUnnormalizedJsxDevelopmentMetadata,
  lower,
  oracle,
} from './oracle';
import { cliResult } from './cli-oracle';
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
      expect(checked.input).toBe(
        example.input.endsWith('\n') ? example.input : `${example.input}\n`
      );
      expect(
        canonical(lower(disabledOutputs[index])),
        'native SWC preserves input with injection and hashing disabled'
      ).toBe(canonical(lower(example.input)));
      const compiler = oracle(example.input);
      const expected = canonical(compiler);
      const cli = cliResult(example.input);
      expect(
        cli.output,
        'checked-in CLI output matches the live CLI insertion pass'
      ).toBe(checked.cliOutput);
      expect(
        cli.canonical,
        'the independent CLI oracle agrees with the compiler'
      ).toBe(expected);
      expect(
        cli.runtimeCanonical,
        'CLI helper identities and static children match the compiler'
      ).toBe(canonicalRuntime(compiler));
      expect(
        canonical(lower(checked.output)),
        'checked-in output matches the live compiler'
      ).toBe(expected);
      expect(
        canonicalRuntime(lower(checked.output)),
        'checked-in output preserves compiler runtime semantics'
      ).toBe(canonicalRuntime(compiler));
      expect(
        canonical(lower(outputs[index])),
        'native SWC matches the live compiler'
      ).toBe(expected);
      const development = oracle(example.input, true);
      expect(
        cliResult(example.input, true).runtimeCanonical,
        'development CLI helper identities and static children match the compiler'
      ).toBe(canonicalRuntime(development));
      // Custom runtimes and classic factories retain their exact development
      // calls/metadata. Their production and development host outputs are each
      // compared against the compiler in wasm.test.ts, without equating them.
      if (!hasUnnormalizedJsxDevelopmentMetadata(development))
        expect(
          canonical(development),
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
