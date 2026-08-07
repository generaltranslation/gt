import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format/types';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue template runtime parity', () => {
  it('matches Vue directive scope, slot, and component-name behavior', async () => {
    const result = await extractFixture('template-runtime-parity.vue');

    expect(result.errors).toEqual([]);
    expect(
      result.results
        .filter((update) => update.dataFormat === 'STRING')
        .map((update) => update.source)
    ).toEqual(['Outer v-if', 'v-for default', 'Directive', 'slot default']);

    const richSources = result.results
      .filter((update) => update.dataFormat === 'JSX')
      .map((update) => update.source);
    const branch: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: {
        b: { casual: 'Second', formal: 'First' },
        t: 'b',
      },
    };
    const plural: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: {
        b: { one: 'One', other: 'Other' },
        t: 'p',
      },
    };
    expect(richSources).toEqual([
      'Digit-normalized component',
      'Dynamic component',
      'Explicit default',
      branch,
      plural,
    ]);
  });

  it('still rejects meaningful implicit content beside an explicit default slot', async () => {
    const result = await extractFixture('template-duplicate-default.vue');

    expect(result.results).toEqual([]);
    expect(result.errors.join('\n')).toContain(
      'more than one default slot definition'
    );
  });
});

function fixturePath(name: string): string {
  return path.join(__dirname, 'fixtures', name);
}

async function extractFixture(name: string) {
  const file = fixturePath(name);
  return extractFromVueSource(fs.readFileSync(file, 'utf8'), file, {
    projectRoot: process.cwd(),
  });
}
