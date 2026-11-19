import React, { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '../../rendering/renderPipeline.rsc';
import { Branch } from '../../../components/branches/Branch';
import { Plural } from '../../../components/branches/Plural';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
import { N } from '../../../components/variables/N';
import { RscN } from '../../../components/variables/N.rsc';
import { Var } from '../../../components/variables/Var';
import { renderPlural } from '../../../components/branches/Plural.shared';
import { Num } from '../../../components/variables/Num';
import { fillCount } from '../../plurals/fillCount';
import type { GTTag, TaggedElement } from '../../types';

function gtTag(node: unknown): GTTag {
  return (node as TaggedElement).props['data-_gt'];
}

// Resolves function components to their output so tests can read the text a
// <T> would render without a DOM renderer.
function renderText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderText).join('');
  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    if (typeof node.type === 'function') {
      return renderText(
        (node.type as (props: unknown) => ReactNode)(node.props)
      );
    }
    return renderText(node.props.children);
  }
  return '';
}

describe('<N>, the count of its <Plural>', () => {
  const files = (n: number | bigint) => (
    <Plural n={n} one='One file'>
      {[
        <b key='count'>
          <N />
        </b>,
        ' files',
      ]}
    </Plural>
  );
  const render = (n: number, target?: unknown) => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'ru'] });
    const source = addGTIdentifier(files(n));
    return renderText(
      target
        ? renderTranslatedChildren({
            source,
            target: target as never,
            locales: ['ru'],
            enableI18n: true,
          })
        : renderDefaultChildren({
            children: source,
            defaultLocale: 'en',
            enableI18n: true,
          })
    );
  };

  it('is stored as a count variable, without the count', () => {
    expect(writeChildrenAsObjects(addGTIdentifier(files(1234)))).toEqual({
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: 'One file',
          other: [{ t: 'b', i: 2, c: { i: 3, v: '#' } }, ' files'],
        },
        t: 'p',
      },
    });
  });

  it('renders the count in the source', () => {
    expect(render(1)).toBe('One file');
    expect(render(1234)).toBe('1,234 files');
  });

  it('renders the count where a translation puts it', () => {
    // Russian picks "one" for 21 too, so it shows the count there.
    const count = { i: 3, v: '#' };
    const target = {
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: [count, ' файл'],
          other: [{ t: 'b', i: 2, c: count }, ' файла'],
        },
        t: 'p',
      },
    };

    expect(render(21, target)).toBe('21 файл');
    expect(render(22, target)).toBe('22 файла');
  });

  it('renders the count in a named branch of a <Branch>', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en'] });
    const source = addGTIdentifier(
      <Plural n={5}>
        <Branch branch='photo' photo={[<N key='count' />, ' photos']}>
          {[<N key='count' />, ' files']}
        </Branch>
      </Plural>
    );

    expect(
      renderText(
        renderDefaultChildren({
          children: source,
          defaultLocale: 'en',
          enableI18n: true,
        })
      )
    ).toBe('5 photos');
  });

  describe('that no <Plural> gave a count', () => {
    const lone = () => addGTIdentifier(['Total: ', <N key='count' />]);
    function Count(props: object) {
      return <RscN {...props} _locale='en' _enableI18n />;
    }

    it('logs and renders nothing in production', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en'] });

      expect(
        renderText(
          renderDefaultChildren({
            children: lone(),
            defaultLocale: 'en',
            enableI18n: true,
          })
        )
      ).toBe('Total: ');
      expect(renderText(<Count />)).toBe('');
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('<N> has no count to show')
      );
      error.mockRestore();
    });

    it('throws in development, inside and outside <T>', () => {
      vi.stubEnv('NODE_ENV', 'development');
      try {
        expect(lone).toThrow('<N> has no count to show');
        expect(() => renderText(<Count />)).toThrow('<N> has no count to show');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  // Every plural branch a <T> tags goes through fillCount, so a branch with no
  // <N> must come back as the same object: tagging then sees what it always did.
  it.each<[string, ReactNode]>([
    ['text', 'files'],
    ['NaN', NaN],
    ['empty and falsy children', [NaN, ' items', null, false, 0, '']],
    ['nested arrays', [['a', <b key='b'>b</b>], [<i key='i'>i</i>]]],
    [
      'a fragment',
      <>
        <b>a</b> b
      </>,
    ],
    ['a function child', <div>{(() => 'x') as unknown as ReactNode}</div>],
    [
      'a <Branch> with a NaN prop',
      <Branch branch={NaN as unknown as string} {...{ photo: <b>p</b> }}>
        x
      </Branch>,
    ],
    [
      'a nested <Plural> with an <N>',
      <Plural n={2} one='x'>
        <N />
      </Plural>,
    ],
    [
      'a deep tree',
      <section>
        <ul>
          <li>
            <a href='/x'>
              <Num>{3}</Num> <b>x</b>
            </a>
          </li>
        </ul>
      </section>,
    ],
  ])(
    'leaves a branch with no <N> of its own untouched: %s',
    (_name, branch) => {
      expect(fillCount(branch, 5)).toBe(branch);
    }
  );

  it('takes the id a <Num> in its place would', () => {
    const tagged = (count: ReactNode) =>
      writeChildrenAsObjects(
        addGTIdentifier(
          <Plural n={5} one={[<i key='i'>one</i>, count]}>
            {[<b key='b'>{count}</b>, ' of ', <i key='i'>them</i>]}
          </Plural>
        )
      );

    expect(
      JSON.parse(JSON.stringify(tagged(<N />)).replaceAll('"#"', '"n"'))
    ).toEqual(tagged(<Num>{5}</Num>));
  });

  // A server component has no context, so its <Plural> hands the count over.
  describe('in a <Plural> outside <T>', () => {
    const conditions = { _locale: 'en', _enableI18n: true };
    function Count(props: object) {
      return <RscN {...props} {...conditions} />;
    }
    Count._gtt = 'variable-count';
    function Nested(props: { n: number; children: ReactNode }) {
      return renderPlural({ ...props, ...conditions });
    }
    Nested._gtt = 'plural';
    const bare = (children: ReactNode) =>
      renderPlural({ ...conditions, n: 5, children });

    it('renders the count, and a nested <Plural> its own', () => {
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en'] });
      expect(
        renderText(
          bare([
            <b key='count'>
              <Count />
            </b>,
            ' files, ',
            <Nested key='nested' n={7}>
              <Count />
            </Nested>,
          ])
        )
      ).toBe('5 files, 7');
    });

    it('renders the count in a named branch of a <Branch>', () => {
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en'] });
      expect(
        renderText(
          bare(
            <Branch branch='photo' photo={[<Count key='count' />, ' photos']}>
              files
            </Branch>
          )
        )
      ).toBe('5 photos');
    });

    it('renders the count in the translation of a <T> inside it', () => {
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'ru'] });
      // What a <T> in the branch gets as its children: it has no plural.
      const source = addGTIdentifier(bare([<Count key='count' />, ' files']));

      expect(
        renderText(
          renderTranslatedChildren({
            source,
            target: [{ i: 1, v: '#' }, ' файлов'],
            locales: ['ru'],
            enableI18n: true,
          })
        )
      ).toBe('5 файлов');
    });

    it('returns a branch with no <N> as it is', () => {
      const branch = [<b key='b'>Many</b>, ' files'];
      expect(bare(branch)).toBe(branch);
    });
  });
});

// https://github.com/generaltranslation/gt/issues/2077
describe('addGTIdentifier with <RelativeTime>', () => {
  it('tags <RelativeTime> as a relativetime variable', () => {
    const tagged = addGTIdentifier(<RelativeTime value={-3} unit='day' />);

    expect(gtTag(tagged)).toMatchObject({
      transformation: 'variable',
      variableType: 'relativetime',
      injectionType: 'manual',
    });
  });

  it('writes the same variable shape the extractors hash', () => {
    const tagged = addGTIdentifier([
      'Posted ',
      <RelativeTime key='time' value={-3} unit='day' />,
    ]);

    expect(writeChildrenAsObjects(tagged)).toEqual([
      'Posted ',
      { i: 1, v: 'rt' },
    ]);
  });

  it('marks the compiler-injected <RelativeTime> as automatic', () => {
    const tagged = addGTIdentifier(
      <GtInternalRelativeTime value={-3} unit='day' />
    );

    expect(gtTag(tagged)).toMatchObject({
      variableType: 'relativetime',
      injectionType: 'automatic',
    });
  });

  it('tags <RelativeTime> inside a Plural branch prop', () => {
    const tagged = addGTIdentifier(
      <Plural n={1} one={<RelativeTime value={-3} unit='day' />}>
        Later
      </Plural>
    );

    expect(gtTag(gtTag(tagged).branches?.one)).toMatchObject({
      variableType: 'relativetime',
    });
  });

  it('stores an exact Plural branch under its ICU key', () => {
    const tagged = addGTIdentifier(
      <Plural n={0} _0='None'>
        Some
      </Plural>
    );

    expect(writeChildrenAsObjects(tagged)).toEqual({
      t: 'Plural',
      i: 1,
      d: { b: { '=0': 'None', other: 'Some' }, t: 'p' },
    });
    expect(
      renderDefaultChildren({
        children: tagged,
        defaultLocale: 'en',
        enableI18n: true,
      })
    ).toBe('None');
  });

  it('stores the children of a Branch as other, over an other prop', () => {
    const tagged = addGTIdentifier(
      <Branch branch='x' {...{ other: 'Prop' }}>
        Children
      </Branch>
    );

    expect(gtTag(tagged).branches).toEqual({ other: 'Children' });
  });

  it('neither stores nor renders an other prop of a Branch with no children', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tagged = addGTIdentifier(
      <Branch branch='missing' {...{ other: 'Prop' }}>
        {undefined}
      </Branch>
    );

    expect(writeChildrenAsObjects(tagged)).toEqual({ t: 'Branch', i: 1 });
    expect(
      renderDefaultChildren({
        children: tagged,
        defaultLocale: 'en',
        enableI18n: true,
      })
    ).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('<Branch> has no branch for its value')
    );
    error.mockRestore();
  });

  // `gt` and the compiler give this source the same hash; a tag name is not hashed.
  it.each([null, false, ''])(
    'stores no branches for a lone empty fallback: %j',
    (empty) => {
      const sources = [
        [
          'Before ',
          <Branch key='b' branch='x'>
            {empty}
          </Branch>,
          ' after',
        ],
        [
          'Before ',
          <Plural key='p' n={2}>
            {empty}
          </Plural>,
          ' after',
        ],
      ].map((source) => writeChildrenAsObjects(addGTIdentifier(source)));

      expect(sources).toEqual([
        ['Before ', { t: 'Branch', i: 1 }, ' after'],
        ['Before ', { t: 'Plural', i: 1 }, ' after'],
      ]);
      expect(
        sources.map((source) => hashSource({ dataFormat: 'JSX', source }))
      ).toEqual(['b5a6ee4eef4e3071', 'b5a6ee4eef4e3071']);
    }
  );

  it('stores a name only for a variable that was given one', () => {
    const tagged = addGTIdentifier([
      <Var key='a'>Alice</Var>,
      ' / ',
      <Var key='b' name='user'>
        Bob
      </Var>,
      <Var key='c' name=''>
        Eve
      </Var>,
    ]);

    expect(writeChildrenAsObjects(tagged)).toEqual([
      { i: 1, v: 'v' },
      ' / ',
      { i: 2, k: 'user', v: 'v' },
      { i: 3, v: 'v' },
    ]);
  });

  it('finds a translated variable by its id, so equal names do not collide', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    const source = addGTIdentifier([
      <Var key='a' name='who'>
        Alice
      </Var>,
      ' / ',
      <Var key='b' name='who'>
        Bob
      </Var>,
    ]);

    expect(
      renderText(
        renderTranslatedChildren({
          source,
          target: [
            { i: 2, k: 'who', v: 'v' },
            ' / ',
            { i: 1, k: 'who', v: 'v' },
          ],
          locales: ['fr'],
          enableI18n: true,
        })
      )
    ).toBe('Bob / Alice');
  });

  it('renders <RelativeTime> in <T> source content as formatted time', () => {
    initializeI18nConfig({ defaultLocale: 'en' });
    const tagged = addGTIdentifier([
      'Posted ',
      <RelativeTime key='time' value={-3} unit='day' />,
    ]);

    const rendered = renderDefaultChildren({
      children: tagged,
      defaultLocale: 'en',
      enableI18n: true,
    });

    expect(renderText(rendered)).toBe('Posted 3 days ago');
  });
});
