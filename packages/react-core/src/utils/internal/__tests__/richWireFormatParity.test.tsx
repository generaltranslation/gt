import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { Branch } from '../../../components/branches/Branch';
import { Plural } from '../../../components/branches/Plural';
import { Num } from '../../../components/variables/Num';
import { Var } from '../../../components/variables/Var';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';

type WireFormatFixture = {
  description: string;
  hash: string;
  id: keyof typeof sources;
  source: JsxChildren;
};

const sources = {
  'nested-element': [
    'Hello ',
    <strong key='strong'>
      wonderful <em>world</em>
    </strong>,
    '.',
  ],
  'typed-variables': [
    'Hello ',
    <Var key='name'>Ada</Var>,
    ', you have ',
    <Num key='count'>3</Num>,
    ' messages.',
  ],
  'independent-branch-numbering': [
    <Branch
      key='branch'
      branch='formal'
      formal={[
        <strong key='strong'>Hello</strong>,
        ' ',
        <Var key='name'>Ada</Var>,
      ]}
      casual={[<em key='em'>Hi</em>, ' ', <Var key='name'>Ada</Var>]}
    >
      Fallback
    </Branch>,
    <span key='after'>After</span>,
  ],
  'independent-plural-numbering': [
    <Plural
      key='plural'
      n={2}
      one={['One ', <Num key='count'>1</Num>]}
      other={['Many ', <Num key='count'>2</Num>]}
    >
      Fallback
    </Plural>,
    <span key='after'>After</span>,
  ],
} satisfies Record<string, ReactNode>;

const fixtures = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../../test-fixtures/rich-content-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
) as WireFormatFixture[];

describe('shared rich-content wire format', () => {
  it.each(fixtures)('$id: $description', (fixture) => {
    const source = writeChildrenAsObjects(addGTIdentifier(sources[fixture.id]));

    expect(source).toEqual(fixture.source);
    expect(hashSource({ dataFormat: 'JSX', source: fixture.source })).toBe(
      fixture.hash
    );
  });
});
