import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { templateToMessage } from '@generaltranslation/icu/internal';
import { hashSource } from 'generaltranslation/id';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { Libraries, type GTLibrary } from '../../../types/libraries.js';
import type { GTParsingFlags } from '../../../types/parsing.js';
import { matchFiles } from '../../../fs/matchFiles.js';
import { logger } from '../../../console/logger.js';
import { validateProject } from '../../../translation/validate.js';
import wireFormatCases from '../../../../../../test-fixtures/message-tree-wire-format.json' with { type: 'json' };

vi.mock('../../../fs/matchFiles.js', () => ({ matchFiles: vi.fn() }));

const MESSAGE_HELPERS =
  'msg, useGT, getGT, plural, selectordinal, select, number, date, time, part, derive, n';

// The fixtures' free variables, typed as in fixtureParity.test.ts: the CLI
// skips an undeclared value, since TypeScript types it any.
const FIXTURE_VALUES =
  'declare const first: string, second: string, count: number, role: string, price: number, due: Date;';

// The CLI reads value types with TypeScript, so every gt-* import in the
// project resolves to the real gt-i18n types.
const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-message-tree-'));
const i18nEntry = path.resolve(
  import.meta.dirname,
  '../../../../../i18n/src/index'
);
fs.writeFileSync(
  path.join(projectDir, 'gt.d.ts'),
  `export * from '${i18nEntry}';
import type { GT } from '${i18nEntry}';
export declare function useGT(): GT;
export declare function getGT(): Promise<GT>;
`
);
fs.writeFileSync(
  path.join(projectDir, 'tsconfig.json'),
  JSON.stringify({
    files: [],
    compilerOptions: {
      strict: true,
      jsx: 'preserve',
      paths: { 'gt-*': ['./gt.d.ts'], '@helpers/*': ['./*'] },
    },
  })
);

// A subproject without strictNullChecks, where TypeScript hides undefined.
const looseDir = path.join(projectDir, 'loose');
fs.mkdirSync(looseDir);
fs.writeFileSync(
  path.join(looseDir, 'tsconfig.json'),
  JSON.stringify({
    files: [],
    compilerOptions: {
      strict: false,
      jsx: 'preserve',
      paths: { 'gt-*': ['../gt.d.ts'] },
    },
  })
);

const tempFiles: string[] = [];

afterEach(() => {
  for (const file of tempFiles) {
    fs.rmSync(file, { force: true, recursive: true });
  }
  tempFiles.length = 0;
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

/** Writes a file into the test project and returns its import specifier. */
function writeModule(
  code: string,
  extension = 'tsx',
  dir = projectDir
): string {
  const name = `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const file = path.join(dir, `${name}.${extension}`);
  fs.writeFileSync(file, code, 'utf8');
  tempFiles.push(file);
  return `./${name}`;
}

async function extract(
  code: string,
  library: GTLibrary = Libraries.GT_NEXT,
  parsingFlags = {} as GTParsingFlags,
  dir = projectDir
) {
  const file = path.join(dir, `${writeModule(code, 'tsx', dir)}.tsx`);
  vi.mocked(matchFiles).mockReturnValue([file]);
  return createInlineUpdates(library, false, undefined, parsingFlags, {
    conditionNames: [],
  });
}

const treeUpdates = (result: Awaited<ReturnType<typeof extract>>) =>
  result.updates.filter((update) => update.dataFormat === 'MESSAGE_TREE');

describe('createInlineUpdates: tagged templates', () => {
  // `t` in each fixture template becomes the tag under test.
  const forms: Record<string, (template: string) => string> = {
    t: (template) => template,
    msg: (template) => template.replace(/^t(?=[`(])/, 'msg'),
    useGT: (template) =>
      `export function Component() {\n  const t = useGT();\n  return ${template};\n}`,
    getGT: (template) =>
      `export async function load() {\n  const t = await getGT();\n  return ${template};\n}`,
  };

  describe.each(Object.keys(forms))('fixture parity via %s', (form) => {
    it.each(wireFormatCases.map((testCase) => [testCase.name, testCase]))(
      '%s',
      async (_name, testCase) => {
        const result = await extract(
          `import { ${form === 't' ? 't, ' : ''}${MESSAGE_HELPERS} } from 'gt-i18n';\n${FIXTURE_VALUES}\n${forms[form](testCase.template)};\n`
        );

        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.updates).toHaveLength(1);
        const [update] = result.updates;
        expect(update.dataFormat).toBe('MESSAGE_TREE');
        expect(update.source).toEqual(testCase.tree);
        expect(update.metadata.hash).toBe(testCase.hash);
      }
    );
  });

  it.each([
    "import { useGT } from 'gt-react';\nexport function Component() {\n  const t = useGT();\n  return t`Hello`;\n}\n",
    "import { getGT } from 'gt-next/server';\nexport async function load() {\n  const t = await getGT();\n  return t`Hello`;\n}\n",
    "import { t } from 'gt-react';\nt`Hello`;\n",
  ])('extracts a message once from a bare stable import', async (code) => {
    const result = await extract(code);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.updates.map((u) => [u.dataFormat, u.source])).toEqual([
      ['MESSAGE_TREE', templateToMessage(['Hello'], []).tree],
    ]);
  });

  it('does not read gt-react-native as gt-react', async () => {
    const result = await extract(
      "import { t, T } from 'gt-react-native';\nt`Hello`;\n<T>Hello</T>;\n"
    );
    expect(result.updates).toEqual([]);
  });

  it('stores maxChars and requiresReview options in metadata and the hash', async () => {
    const result = await extract(`
      import { t } from 'gt-react';
      t({ maxChars: -12, requiresReview: true })\`Read more\`;
    `);

    const [update] = treeUpdates(result);
    expect(update.metadata).toMatchObject({
      maxChars: 12,
      requiresReview: true,
    });
    expect(update.metadata.hash).toBe(
      hashSource({
        source: 'Read more',
        dataFormat: 'MESSAGE_TREE',
        maxChars: 12,
        requiresReview: true,
      })
    );
  });

  it('skips a message with an unsupported option', async () => {
    const result = await extract(`
      import { t } from 'gt-react';
      t({ locale: 'fr' })\`Save\`;
      t\`Still extracted\`;
    `);

    expect(result.warnings.join('\n')).toContain(
      'the t() option "locale" is not supported'
    );
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Still extracted',
    ]);
  });

  it('follows aliased imports and same-file const part references', async () => {
    const result = await extract(`
      import { t as translate, plural as p, part as fragment, n as pound } from 'gt-react';
      const from = fragment\`from \${{ who }}\`;
      translate\`\${p({ count }, { one: fragment\`\${pound} message \${from}\`, other: from })}\`;
    `);

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      [
        [
          'count',
          'plural',
          { one: [0, ' message from ', ['who']], other: ['from ', ['who']] },
        ],
      ],
    ]);
  });

  it('emits one linked entry per derive() variant', async () => {
    const result = await extract(`
      import { t, derive } from 'gt-react';
      const isMorning = Math.random() > 0.5;
      t\`Good \${derive(isMorning ? 'morning' : 'evening')}\`;
    `);

    const updates = treeUpdates(result);
    expect(updates.map((u) => u.source)).toEqual([
      'Good evening',
      'Good morning',
    ]);
    expect(updates[0].metadata.staticId).toBeTruthy();
    expect(updates[0].metadata.staticId).toBe(updates[1].metadata.staticId);
  });

  it('skips non-static messages with a warning and keeps extracting', async () => {
    const result = await extract(`
      import { t, plural, derive } from 'gt-react';
      export function Component({ ctx, branches, role }) {
        const hoisted = derive(role);
        t\`Hi \${hoisted}\`;
        let later;
        later = plural({ count }, { other: '#' });
        t\`\${later}\`;
        t({ context: ctx })\`Save\`;
        t\`\${plural({ count }, branches)}\`;
        t\`Hi \${{ a, b }}\`;
        t\`Signed in as \${derive(role)}\`;
        return t\`Still extracted\`;
      }
    `);

    expect(result.errors).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Still extracted',
    ]);
    const skipped = result.warnings.filter((warning) =>
      warning.includes('Skipped a tagged-template message')
    );
    expect(skipped).toHaveLength(6);
    expect(skipped.join('\n')).toMatch(/\(5:\d+\)/);
    expect(skipped.join('\n')).toContain('built outside the template');
  });

  it('ignores sources outside the configured library', async () => {
    const result = await extract(
      `import { t } from 'gt-react';\nt\`Hello\`;\n`,
      Libraries.GT_NODE
    );
    expect(result.updates).toEqual([]);
  });

  describe('derive() reads its variants from the TypeScript type', () => {
    it.each([
      ['any string', 'declare const label: string;\nt`${derive(label)}`;'],
      [
        'a widened single literal',
        "function label() { return 'Guest'; }\nt`${derive(label())}`;",
      ],
      [
        'a template literal with a value',
        'declare const n: number;\nt`${derive(`Chapter ${n}`)}`;',
      ],
    ])('skips derive() of %s', async (_name, code) => {
      const result = await extract(
        `import { t, derive } from 'gt-react';\n${code}\nt\`Still extracted\`;\n`
      );

      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        'Still extracted',
      ]);
      expect(result.warnings.join('\n')).toContain(
        'the derive() value is typed as any string'
      );
    });

    // A host such as getValidateJson() can extract twice in one process.
    it('reads the types of an edited file on the next run', async () => {
      const header = `import { t, derive } from 'gt-react';\ndeclare const txt: string;\n`;
      const specifier = writeModule(`${header}t\`${'$'}{derive('A')}\`;\n`);
      const file = path.join(projectDir, `${specifier}.tsx`);
      vi.mocked(matchFiles).mockReturnValue([file]);
      const run = () =>
        createInlineUpdates(
          Libraries.GT_NEXT,
          false,
          undefined,
          {},
          {
            conditionNames: [],
          }
        );

      expect(treeUpdates(await run()).map((u) => u.source)).toEqual(['A']);
      // Same length, so stale types would still find a literal there.
      fs.writeFileSync(file, `${header}t\`${'$'}{derive(txt)}\`;\n`);
      const edited = await run();
      expect(treeUpdates(edited)).toEqual([]);
      expect(edited.warnings.join('\n')).toContain(
        'the derive() value is typed as any string'
      );
    });

    it('skips derive() of a value that is not a string', async () => {
      const result = await extract(`
        import { t, derive } from 'gt-react';
        declare const flag: boolean;
        t\`\${derive(flag ? 1 : 2)}\`;
      `);

      expect(treeUpdates(result)).toEqual([]);
      expect(result.warnings.join('\n')).toContain(
        'the derive() value is not typed as a string'
      );
    });

    it('extracts every return of a helper', async () => {
      const result = await extract(`
        import { t, derive } from 'gt-react';
        function label(user?: { name: string }) {
          if (!user) return 'Guest';
          return 'Member';
        }
        t\`Signed in as \${derive(label())}\`;
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        'Signed in as Guest',
        'Signed in as Member',
      ]);
    });

    it('extracts an as const lookup imported from another file', async () => {
      const labels = writeModule(
        "export const labels = { admin: 'Admin', member: 'Member' } as const;\n",
        'ts'
      );
      const result = await extract(`
        import { t, derive } from 'gt-react';
        import { labels } from '${labels}';
        declare const role: keyof typeof labels;
        t\`\${derive(labels[role])}\`;
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        'Admin',
        'Member',
      ]);
    });

    it('hashes derived text like text written in the template', async () => {
      const [derived] = treeUpdates(
        await extract(
          "import { t, derive } from 'gt-react';\nt`Hello ${derive('world')}`;\n"
        )
      );
      const [written] = treeUpdates(
        await extract("import { t } from 'gt-react';\nt`Hello world`;\n")
      );

      expect(derived.source).toEqual('Hello world');
      expect(derived.metadata.hash).toBe(written.metadata.hash);
    });
  });

  it.each([
    ['an object variable', 'const vars = { name };\nt`Hi ${vars}`;'],
    [
      'an aliased helper',
      "const many = plural;\nt`${many({ count }, { other: '#' })}`;",
    ],
    ['a conditional helper', 't`${flag ? number({ a }) : number({ b })}`;'],
    ['a conditional fragment', 't`${flag ? part`a` : part`b`}`;'],
    [
      'a helper result returned from a function',
      "const status = () => select({ s }, { other: 'x' });\nt`${status()}`;",
    ],
    [
      'a fragment read from a local object',
      'const fragments = { greeting: part`Hi ${{ name }}!` };\nt`${plural({ count }, { other: part`${fragments.greeting}` })}`;',
    ],
    [
      'a fragment read from an object checked twice',
      "const f = { plain: '', greeting: part`Hi` };\nt`${flag ? f.plain : f.greeting}`;",
    ],
    [
      'an aliased n',
      'const h = n;\nt`${plural({ count }, { other: part`${h} items` })}`;',
    ],
    [
      'an unnamed plural value that holds a { name: value } object',
      "const vars = { count: 2 };\nt`${plural(vars, { other: 'x' })}`;",
    ],
    [
      'an unnamed number value that holds a { name: value } object',
      'const vars = { price: 2 };\nt`${number(vars)}`;',
    ],
  ])('skips a value typed as a placeholder: %s', async (_name, code) => {
    const result = await extract(
      `import { t, plural, number, part, select, n } from 'gt-react';\n${code}\n`
    );

    expect(treeUpdates(result)).toEqual([]);
    expect(result.warnings.join('\n')).toContain('not typed as a primitive');
  });

  it.each([
    [
      'a branch template literal with values',
      't`${plural({ count }, { other: `from ${name}` })}`;',
      'has values but is not part`...`',
    ],
    ['n outside a plural', 't`${n} items`;', 'plural count is used outside'],
    [
      'a branch destructured from a part',
      'const { strings: [branch] } = part`Hi ${{ name }}`;\nt`${plural({ count }, { other: branch })}`;',
      'a branch is not a string literal or part`...`',
    ],
  ])('skips a message with %s', async (_name, code, warning) => {
    const result = await extract(
      `import { t, plural, part, n } from 'gt-react';\n${code}\n`
    );

    expect(treeUpdates(result)).toEqual([]);
    expect(result.warnings.join('\n')).toContain(warning);
  });

  it('reads branches wrapped in type assertions', async () => {
    const result = await extract(
      "import { t, select, part } from 'gt-react';\nt`${select({ s }, { a: 'A' as const, b: part`B` satisfies object, other: 'C'! })}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result)).toHaveLength(1);
  });

  it('reads a destructured value as an anonymous value', async () => {
    const result = await extract(
      "import { t } from 'gt-react';\nconst { name } = { name: 'Ada' };\nt`Hi ${name}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Hi ', ['_gt_1']],
    ]);
  });

  it('reads a value typed as a template literal type as an anonymous value', async () => {
    const result = await extract(
      "import { t } from 'gt-react';\ndeclare const id: `id-${string}`;\nt`Item ${id}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Item ', ['_gt_1']],
    ]);
  });

  it('reads a type-asserted object as a named variable', async () => {
    const result = await extract(
      "import { t } from 'gt-react';\nt`Hi ${{ name } as const}`;\n"
    );

    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Hi ', ['name']],
    ]);
  });

  it('reads a Date subclass passed to date()', async () => {
    const result = await extract(
      "import { t, date } from 'gt-react';\nclass CustomDate extends Date {}\nconst due = new CustomDate(0);\nt`Due ${date(due)}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Due ', ['_gt_1', 'date']],
    ]);
  });

  it('reads a generic Date subclass passed to date()', async () => {
    const result = await extract(
      "import { t, date } from 'gt-react';\nclass CustomDate<T> extends Date { extra?: T }\nt`Due ${date(new CustomDate<number>(0))}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Due ', ['_gt_1', 'date']],
    ]);
  });

  // The runtime names an object's key, so `any` could be `{ name }`.
  it('skips a value typed any, whose shape is unknown', async () => {
    const result = await extract(
      'import { t } from \'gt-react\';\nconst hole = JSON.parse(\'{"name":"Ada"}\');\nt`Hi ${hole}`;\n'
    );

    expect(treeUpdates(result)).toEqual([]);
    expect(result.warnings.join('\n')).toContain('any, unknown');
  });

  it('skips a bare Date, which needs date() to be formatted', async () => {
    const result = await extract(
      "import { t } from 'gt-react';\ndeclare const due: Date | string;\nt`Due ${due}`;\n"
    );

    expect(treeUpdates(result)).toEqual([]);
    expect(result.warnings.join('\n')).toContain(
      'a Date needs date() to be formatted'
    );
  });

  it('also extracts the empty derive() variant without strictNullChecks', async () => {
    // Without strictNullChecks, labels.text reads as 'A' though it can be
    // undefined, which derive() renders as no text.
    const result = await extract(
      "import { t, derive } from 'gt-react';\ndeclare const flag: boolean;\nconst labels = flag ? { text: 'A' as const } : {};\nt`Label ${derive((labels as { text: 'A' }).text)}`;\n",
      Libraries.GT_NEXT,
      {} as GTParsingFlags,
      looseDir
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Label ',
      'Label A',
    ]);
  });

  describe('tag aliases', () => {
    it('follows const aliases of t and the useGT() result', async () => {
      const result = await extract(`
        import { t, useGT } from 'gt-react';
        const translate = t;
        translate\`Hello\`;
        export function Component() {
          const gt = useGT();
          const tr = gt;
          return tr\`Bye\`;
        }
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        'Hello',
        'Bye',
      ]);
    });

    it('applies the options of a configured tag', async () => {
      const result = await extract(`
        import { t, useGT } from 'gt-react';
        const save = t({ context: 'button' });
        const alsoSave = save;
        alsoSave\`Save\`;
        export function Component() {
          const gt = useGT();
          const short = gt({ maxChars: 4 });
          return short\`Open\`;
        }
      `);

      expect(result.warnings).toEqual([]);
      const updates = treeUpdates(result);
      expect(updates.map((u) => u.metadata.hash)).toEqual([
        hashSource({
          source: 'Save',
          dataFormat: 'MESSAGE_TREE',
          context: 'button',
        }),
        hashSource({ source: 'Open', dataFormat: 'MESSAGE_TREE', maxChars: 4 }),
      ]);
    });

    it('warns about uses it cannot follow', async () => {
      const result = await extract(`
        import { t, useGT } from 'gt-react';
        register('label', t);
        t.call(null, ['Hi']);
        export { t };
        export const exported = t;
        export function Component() {
          let gt = useGT();
          gt = other;
          return gt\`Still extracted\`;
        }
        type Translate = typeof t;
      `);

      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        'Still extracted',
      ]);
      const untracked = result.warnings.filter((w) =>
        w.includes('Could not follow this use')
      );
      expect(untracked.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
        '3',
        '4',
        '5',
        '6',
        '9',
      ]);
    });
  });

  describe('msg', () => {
    it('extracts a literal call as literal text', async () => {
      const result = await extract(`
        import { msg } from 'gt-react';
        msg('Save');
        msg(\`Hello {name}\`);
        msg('');
      `);

      expect(result.warnings).toEqual([]);
      expect(result.updates).toHaveLength(2);
      expect(
        treeUpdates(result).map((u) => [u.source, u.metadata.hash])
      ).toEqual([
        ['Save', hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' })],
        [
          'Hello {name}',
          hashSource({ source: 'Hello {name}', dataFormat: 'MESSAGE_TREE' }),
        ],
      ]);
    });

    it('extracts tagged and options forms like t', async () => {
      const result = await extract(`
        import { msg } from 'gt-react';
        msg\`Save\`;
        msg({ context: 'button' })\`Save\`;
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result).map((u) => u.metadata.hash)).toEqual([
        hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' }),
        hashSource({
          source: 'Save',
          dataFormat: 'MESSAGE_TREE',
          context: 'button',
        }),
      ]);
    });

    it('follows aliases and configured tags', async () => {
      const result = await extract(`
        import { msg as message } from 'gt-react';
        const mm = message;
        mm('Hi');
        mm\`Bye\`;
        const save = mm({ context: 'button' });
        save\`Save\`;
      `);

      expect(result.warnings).toEqual([]);
      expect(
        treeUpdates(result).map((u) => [u.source, u.metadata.context])
      ).toEqual([
        ['Hi', undefined],
        ['Bye', undefined],
        ['Save', 'button'],
      ]);
    });

    it('warns about a call it cannot extract', async () => {
      const result = await extract(`
        import { msg } from 'gt-react';
        msg(label);
        msg('a', 'b');
        msg(\`Hi \${name}\`);
        msg();
      `);

      expect(treeUpdates(result)).toEqual([]);
      const skipped = result.warnings.filter((w) =>
        w.includes('Skipped a msg() call')
      );
      expect(skipped.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
        '3',
        '4',
        '5',
        '6',
      ]);
    });

    it('does not extract m() calls', async () => {
      const result = await extract(`
        import { msg, useMessages } from 'gt-react';
        export function Component({ label }) {
          const m = useMessages();
          return [m(msg('Save')), m('Other'), m(label)];
        }
      `);

      expect(result.warnings).toEqual([]);
      expect(result.updates.map((u) => u.source)).toEqual(['Save']);
    });
  });

  it('skips a reserved variable name with a warning and keeps extracting', async () => {
    const result = await extract(`
      import { t } from 'gt-react';
      t\`Hello \${{ _gt_name }}\`;
      t\`Still extracted\`;
    `);

    expect(result.warnings.join('\n')).toContain(
      'Skipped a tagged-template message because the message tree could not be built.'
    );
    expect(result.warnings.join('\n')).toContain(
      'Details: Error: Message variable "_gt_name" uses the reserved "_gt_" prefix.'
    );
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Still extracted',
    ]);
  });

  describe('Intl options', () => {
    const extractTrees = async (message: string) => {
      const result = await extract(
        `import { t, number, date, time } from 'gt-react';\ndeclare const zone: string, code: () => string;\n${message};\n`
      );
      return { warnings: result.warnings, updates: treeUpdates(result) };
    };

    it.each([
      [
        'currency',
        "t`${number({ p }, { style: 'currency', currency: code() })}`",
        "t`${number({ p }, { style: 'currency', currency: 'USD' })}`",
      ],
      [
        'timeZone',
        "t`${date({ d }, { style: 'medium', timeZone: zone })}`",
        "t`${date({ d }, { style: 'medium', timeZone: 'UTC' })}`",
      ],
      [
        'timeZone on time()',
        "t`${time({ s }, { style: 'short', timeZone: zone })}`",
        't`${time({ s }, { style: `short` })}`',
      ],
    ])(
      'extracts a dynamic %s with the hash of a literal one',
      async (_name, dynamic, literal) => {
        const dynamicResult = await extractTrees(dynamic);
        const literalResult = await extractTrees(literal);

        expect(dynamicResult.warnings).toEqual([]);
        expect(dynamicResult.updates).toHaveLength(1);
        expect(dynamicResult.updates[0].metadata.hash).toBe(
          literalResult.updates[0].metadata.hash
        );
      }
    );

    it('extracts time() as a time placeholder', async () => {
      const { warnings, updates } = await extractTrees(
        "t`Starts ${time({ s }, { style: 'short' })} or ${time({ s })}`"
      );

      expect(warnings).toEqual([]);
      expect(updates.map((u) => u.source)).toEqual([
        ['Starts ', ['s', 'time', 'short'], ' or ', ['s', 'time']],
      ]);
    });

    it.each([
      ['style', 't`${date({ d }, { style: zone as "short" })}`'],
      ['style', 't`${number({ p }, { style: zone as "percent" })}`'],
      ['unit', "t`${number({ p }, { style: 'unit', unit: code() })}`"],
    ])('skips a non-literal %s with a warning', async (key, message) => {
      const { warnings, updates } = await extractTrees(message);

      expect(updates).toEqual([]);
      expect(warnings.join('\n')).toContain(
        `the option "${key}" is not a literal`
      );
    });

    it('skips an option of the wrong helper with the builder error', async () => {
      const { warnings, updates } = await extractTrees(
        "t`${time({ s }, { year: 'numeric' })}`"
      );

      expect(updates).toEqual([]);
      expect(warnings.join('\n')).toContain('a time has no "year" option');
    });

    it.each([
      [
        'two named styles',
        "t`${date({ d }, { style: 'short' })} / ${date({ d }, { style: 'long' })}`",
      ],
      [
        'the same context in another order',
        "t`${date({ d }, { style: 'short', timeZone: 'UTC', calendar: 'gregory' })} ${date({ d }, { calendar: 'gregory', timeZone: 'UTC' })}`",
      ],
      [
        // Formatting context never reaches the tree; the runtime reports this.
        'two formatting contexts',
        't`${number({ p }, { maximumFractionDigits: 1 })} ${number({ p }, { maximumFractionDigits: 2 })}`',
      ],
      [
        'a dynamic and a literal context value',
        "t`${number({ p }, { currency: code(), style: 'currency' })} ${number({ p }, { currency: 'USD', style: 'currency' })}`",
      ],
      ['an argument and a number', 't`${{ n }} (${number({ n })})`'],
    ])('extracts a name reused with %s', async (_name, message) => {
      const { warnings, updates } = await extractTrees(message);

      expect(warnings).toEqual([]);
      expect(updates).toHaveLength(1);
    });
  });

  it('skips a message with too many variants instead of expanding it', async () => {
    const branches = Array.from({ length: 20 }, (_, i) => `b${i}: shared`).join(
      ', '
    );
    const result = await extract(`
      import { t, part, select, derive } from 'gt-react';
      const shared = part\`\${derive(flag ? 'Ready' : 'Waiting')}\`;
      t\`\${select({ status }, { ${branches}, other: 'Other' })}\`;
      t\`Still extracted\`;
    `);

    expect(result.warnings.join('\n')).toContain('variants');
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Still extracted',
    ]);
  });

  it('skips one derive() with too many variants', async () => {
    const result = await extract(`
      import { t, derive } from 'gt-react';
      type D = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'x';
      declare const code: \`\${D}\${D}\${D}\`;
      t\`\${derive(code)}\`;
      t\`Still extracted\`;
    `);

    expect(result.warnings.join('\n')).toContain('variants');
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Still extracted',
    ]);
  });

  it('warns about require() and import() that can take a message helper', async () => {
    const result = await extract(`
      const { t } = require('gt-react');
      const lazy = import('gt-react');
      const { T } = require('gt-react');
      t\`Hello\`;
    `);

    const unsupported = result.warnings.filter((w) => w.includes('gt-react'));
    expect(unsupported.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '2',
      '3',
    ]);
    expect(treeUpdates(result)).toEqual([]);
  });

  it('does not warn about an awaited import() that takes no message helper', async () => {
    const result = await extract(`
      export async function load() {
        const { T } = await import('gt-react');
        const { t } = await import('gt-react');
        return [T, t];
      }
    `);

    const unsupported = result.warnings.filter((w) =>
      w.includes('through require()')
    );
    expect(unsupported.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '4',
    ]);
  });

  it('names a string call as one, since only tagged templates are extracted', async () => {
    const result = await extract(`
      import { t, useGT } from 'gt-react';
      t('Hello');
      function Component() {
        const translate = useGT();
        translate(\`Hello\`);
        return useGT()('Hello');
      }
    `);

    const stringCalls = result.warnings.filter((w) =>
      w.includes('Skipped a string call')
    );
    expect(stringCalls.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '3',
      '6',
      '7',
    ]);
    expect(
      result.warnings.filter((w) => w.includes('Could not follow this use'))
    ).toEqual([]);
    expect(treeUpdates(result)).toEqual([]);
  });

  it('warns about a hook used without calling it', async () => {
    const result = await extract(`
      import { useGT } from 'gt-react';
      const useTranslate = useGT;
      type Hook = typeof useGT;
      function Component() {
        const t = useTranslate();
        return t\`Hello\`;
      }
    `);

    const unfollowed = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    expect(unfollowed.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual(['3']);
  });

  it('warns about namespace imports and re-exports of message helpers', async () => {
    const result = await extract(`
      import * as GT from 'gt-react';
      export { t } from 'gt-react';
      export * from 'gt-react';
      export { T } from 'gt-react';
      GT.t\`Hello\`;
    `);

    const unsupported = result.warnings.filter((w) => w.includes('gt-react'));
    expect(unsupported.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '2',
      '3',
      '4',
    ]);
  });

  describe('plural and selectordinal branch keys', () => {
    it.each([
      ['plural', 'onee'],
      ['selectordinal', 'first'],
    ])(
      'skips a %s with the branch %s, which is not a plural category',
      async (helper, key) => {
        const result = await extract(`
          import { t, ${helper} } from 'gt-react';
          declare const count: number;
          t\`\${${helper}({ count }, { ${key}: 'One file', other: 'Many files' })}\`;
          t\`Still extracted\`;
        `);

        expect(result.warnings.join('\n')).toContain(
          `${helper}() has the branch ${key}, which is not a plural category. Use zero, one, two, few, many, other, or an exact number like =0`
        );
        expect(treeUpdates(result).map((u) => u.source)).toEqual([
          'Still extracted',
        ]);
      }
    );

    it.each(['plural', 'selectordinal'])(
      'accepts =0 and the six categories in %s',
      async (helper) => {
        const result = await extract(`
          import { t, ${helper} } from 'gt-react';
          declare const count: number;
          t\`\${${helper}({ count }, { '=0': 'a', zero: 'b', one: 'c', two: 'd', few: 'e', many: 'f', other: 'g' })}\`;
        `);

        expect(result.warnings).toEqual([]);
        expect(treeUpdates(result)).toHaveLength(1);
      }
    );
  });

  describe('select branches', () => {
    const extractSelect = (call: string, dir?: string) =>
      extract(
        `import { t, select } from 'gt-react';\ndeclare const role: 'admin' | 'member' | 'guest';\ndeclare const blank: 'admin' | '';\ndeclare const maybe: 'admin' | 'member' | undefined;\ndeclare const name: string;\nt\`\${${call}}\`;\n`,
        undefined,
        undefined,
        dir
      );

    it.each([
      ["select({ role }, { admin: 'Admins' })", "'guest', 'member'"],
      ["select(role, { admin: 'Admins' })", "'guest', 'member'"],
      ["select({ role } as const, { admin: 'Admins' })", "'guest', 'member'"],
      [
        "select({ role } satisfies object, { admin: 'Admins' })",
        "'guest', 'member'",
      ],
      ["select({ role }!, { admin: 'Admins' })", "'guest', 'member'"],
      ["select({ maybe }, { admin: 'Admins' })", "'member'"],
      // ICU cannot write an empty key, so this one needs other.
      ["select({ blank }, { admin: 'Admins' })", "''"],
    ])(
      'skips %s, which has no other and no branch for %s',
      async (call, missing) => {
        const result = await extractSelect(call);

        expect(result.warnings.join('\n')).toContain(
          `select needs a branch for ${missing}, or an other branch`
        );
        expect(treeUpdates(result)).toEqual([]);
      }
    );

    it.each([
      ['with other', "select({ role }, { admin: 'Admins', other: 'Others' })"],
      [
        'with a branch for every value',
        "select({ role }, { admin: 'A', member: 'M', guest: 'G' })",
      ],
      ['over any string', "select({ name }, { admin: 'Admins' })"],
      [
        'over a value asserted to one branch',
        "select(role as 'admin', { admin: 'Admins' })",
      ],
    ])('extracts a select %s', async (_name, call) => {
      const result = await extractSelect(call);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result)).toHaveLength(1);
    });

    // There a type hides undefined, which is no value to write a branch for.
    it('extracts a select with a branch for every value without strictNullChecks', async () => {
      const result = await extractSelect(
        "select({ role }, { admin: 'A', member: 'M', guest: 'G' })",
        looseDir
      );

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result)).toHaveLength(1);
    });
  });

  it('fails gt validate when a message is skipped', async () => {
    const specifier = writeModule(
      "import { t } from 'gt-react';\nt`Hi ${{ a, b }}`;\nt`Still extracted`;\n"
    );
    const file = path.join(projectDir, `${specifier}.tsx`);
    vi.mocked(matchFiles).mockReturnValue([file]);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const success = vi.spyOn(logger, 'success').mockImplementation(() => {});

    await expect(
      validateProject(
        {
          files: { gtJson: { parsingFlags: {} } },
          parsingOptions: { conditionNames: [] },
        } as Parameters<typeof validateProject>[0],
        Libraries.GT_REACT,
        [file]
      )
    ).rejects.toThrow('exit');

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.join('\n')).toContain(
      'Skipped a tagged-template message'
    );
    expect(success).not.toHaveBeenCalled();
    for (const spy of [exit, error, success]) spy.mockRestore();
  });

  describe('__proto__ keys', () => {
    const select = (branches: Record<string, string>) =>
      templateToMessage(['', ''], [{ kind: 'select', name: 'role', branches }])
        .tree;

    it.each(["__proto__: 'Proto'", "'__proto__': 'Proto'"])(
      'ignores a %s branch with a warning, like the runtime',
      async (branch) => {
        const result = await extract(`
          import { t, select } from 'gt-react';
          t\`\${select({ role }, { ${branch}, admin: 'Admin', other: 'Guest' })}\`;
        `);

        expect(result.warnings.join('\n')).toContain(
          'Ignored a __proto__ property'
        );
        expect(treeUpdates(result).map((u) => u.source)).toEqual([
          select({ admin: 'Admin', other: 'Guest' }),
        ]);
      }
    );

    it("keeps a computed ['__proto__'] branch", async () => {
      const result = await extract(`
        import { t, select } from 'gt-react';
        t\`\${select({ role }, { ['__proto__']: 'Proto', other: 'Guest' })}\`;
      `);

      expect(result.warnings).toEqual([]);
      const branches = Object.fromEntries([
        ['__proto__', 'Proto'],
        ['other', 'Guest'],
      ]);
      const [update] = treeUpdates(result);
      expect(Object.keys(update.source[0][2])).toEqual(['__proto__', 'other']);
      expect(update.metadata.hash).toBe(
        hashSource({ source: select(branches), dataFormat: 'MESSAGE_TREE' })
      );
      expect(update.metadata.hash).not.toBe(
        hashSource({
          source: select({ other: 'Guest' }),
          dataFormat: 'MESSAGE_TREE',
        })
      );
    });
  });
});

describe('createInlineUpdates: a useGT() or getGT() tag passed to a function', () => {
  type Host = {
    library: GTLibrary;
    source: string;
    hook: 'useGT' | 'getGT';
  };
  const hosts: [string, Host][] = [
    [
      'useGT from gt-react',
      { library: Libraries.GT_REACT, source: 'gt-react', hook: 'useGT' },
    ],
    [
      'useGT from gt-next',
      { library: Libraries.GT_NEXT, source: 'gt-next', hook: 'useGT' },
    ],
    [
      'getGT from gt-next/server',
      { library: Libraries.GT_NEXT, source: 'gt-next/server', hook: 'getGT' },
    ],
    [
      'getGT from gt-node',
      { library: Libraries.GT_NODE, source: 'gt-node', hook: 'getGT' },
    ],
    [
      'useGT from gt-tanstack-start',
      {
        library: Libraries.GT_TANSTACK_START,
        source: 'gt-tanstack-start',
        hook: 'useGT',
      },
    ],
  ];
  const [, nextHost] = hosts[1];
  const helperImports = 'plural, part, n, derive';

  /** A file whose component creates `t` with the host's hook, then runs `body`. */
  const withTag = (host: Host, body: string, declarations = '') =>
    `import { ${host.hook}, ${helperImports}, type GT } from '${host.source}';
${declarations}
${
  host.hook === 'useGT'
    ? 'export function Component() {\n  const t = useGT();'
    : 'export async function load() {\n  const t = await getGT();'
}
  ${body}
}
`;

  /** Extracts the `entries` of a project written with writeProject(). */
  async function extractProject(
    library: GTLibrary,
    files: (dir: string) => Record<string, string>,
    entries = ['page.tsx'],
    parsingFlags = {}
  ) {
    // The CLI scans from process.cwd(), which is a physical path.
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(projectDir, 'p-')));
    tempFiles.push(dir);
    for (const [name, code] of Object.entries(files(path.basename(dir)))) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), code, 'utf8');
    }
    vi.mocked(matchFiles).mockReturnValue(
      entries.map((entry) => path.join(dir, entry))
    );
    return {
      dir,
      result: await createInlineUpdates(
        library,
        false,
        undefined,
        parsingFlags as never,
        {
          conditionNames: [],
        }
      ),
    };
  }

  /** What makes an entry the one the runtime looks up, in a stable order. */
  const entryKeys = (result: Awaited<ReturnType<typeof extract>>) =>
    treeUpdates(result)
      .map(({ source, metadata }) => ({
        source,
        hash: metadata.hash,
        context: metadata.context,
        maxChars: metadata.maxChars,
        requiresReview: metadata.requiresReview,
      }))
      .sort((a, b) => String(a.hash).localeCompare(String(b.hash)));

  type Case = {
    /** The project, with the component in page.tsx. */
    files: (host: Host, dir: string) => Record<string, string>;
    /** The same messages written inline, with the declarations they need. */
    inline: string[];
    declarations?: string;
  };

  const nav = (host: Host, body: string) =>
    `import { ${helperImports}, type GT } from '${host.source}';\n${body}\n`;

  const cases: Record<string, Case> = {
    'a function declaration': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return getInfo(t);',
          'function getInfo(t: GT) {\n  return { home: t`Home`, about: t`About` };\n}'
        ),
      }),
      inline: ['t`Home`', 't`About`'],
    },
    'an arrow function, at a later parameter with a default': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          "return label('home', t);",
          "declare const fallback: GT;\nconst label = (id: string, tr: GT = fallback) => tr({ context: 'nav' })`Home`;"
        ),
      }),
      inline: ["t({ context: 'nav' })`Home`"],
    },
    'a function expression that aliases its parameter': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return getInfo(t);',
          'const getInfo = function (this: unknown, translate: GT) {\n  const tr = translate;\n  const short = tr({ maxChars: 8 });\n  return short`Open`;\n};'
        ),
      }),
      inline: ['t({ maxChars: 8 })`Open`'],
    },
    'message helpers and derive()': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          "return count(t, 2, 'admin');",
          "function count(t: GT, items: number, role: 'admin' | 'member') {\n  return [\n    t`${plural({ items }, { one: 'One item', other: part`${n} items` })}`,\n    t`Signed in as ${derive(role)}`,\n  ];\n}"
        ),
      }),
      declarations:
        "declare const items: number;\ndeclare const role: 'admin' | 'member';",
      inline: [
        "t`${plural({ items }, { one: 'One item', other: part`${n} items` })}`",
        't`Signed in as ${derive(role)}`',
      ],
    },
    'a chain of functions': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return outer(t);',
          'function inner(t: GT) {\n  return t`Inner`;\n}\nfunction outer(t: GT) {\n  return [t`Outer`, inner(t)];\n}'
        ),
      }),
      inline: ['t`Outer`', 't`Inner`'],
    },
    'a configured tag': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          "const navTag = t({ context: 'nav' });\n  return [getInfo(navTag), getInfo(t({ context: 'menu' }))];",
          'function getInfo(t: GT) {\n  return t`Home`;\n}'
        ),
      }),
      inline: ["t({ context: 'nav' })`Home`", "t({ context: 'menu' })`Home`"],
    },
    'recursive functions': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return [walk(t, 3), even(t, 4)];',
          'function walk(t: GT, depth: number): string[] {\n  return depth ? [t`Node`, ...walk(t, depth - 1)] : [t`Leaf`];\n}\nfunction even(t: GT, k: number): string {\n  return k ? odd(t, k - 1) : t`Even`;\n}\nconst odd = (t: GT, k: number): string => (k ? even(t, k - 1) : t`Odd`);'
        ),
      }),
      inline: ['t`Node`', 't`Leaf`', 't`Even`', 't`Odd`'],
    },
    'a named import': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return getNavLabels(t);',
          "import { getNavLabels } from './nav';"
        ),
        'nav.ts': nav(
          host,
          'export function getNavLabels(t: GT) {\n  return { settings: t`Settings` };\n}'
        ),
      }),
      inline: ['t`Settings`'],
    },
    'a renamed import of an exported arrow function': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return labels(t);',
          "import { navLabels as labels } from './nav';"
        ),
        'nav.ts': nav(
          host,
          "export const navLabels = (t: GT) => t({ context: 'nav' })`Settings`;"
        ),
      }),
      inline: ["t({ context: 'nav' })`Settings`"],
    },
    'default imports': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return [first(t), second(t)];',
          "import first from './first';\nimport second from './second';"
        ),
        'first.ts': nav(
          host,
          'export default function (t: GT) {\n  return t`First`;\n}'
        ),
        'second.ts': nav(
          host,
          'function second(t: GT) {\n  return t`Second`;\n}\nexport default second;'
        ),
      }),
      inline: ['t`First`', 't`Second`'],
    },
    're-exports': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return [labels(t), more(t), local(t)];',
          "import { labels, more, local } from './lib';"
        ),
        'lib/index.ts':
          "export { navLabels as labels } from './nav';\nexport * from './more';\nimport { localLabels } from './local';\nexport { localLabels as local };\n",
        'lib/nav.ts': nav(
          host,
          'export function navLabels(t: GT) {\n  return t`Renamed`;\n}'
        ),
        'lib/more.ts': nav(
          host,
          'export function more(t: GT) {\n  return t`Star`;\n}'
        ),
        'lib/local.ts': nav(
          host,
          'export function localLabels(t: GT) {\n  return t`Local`;\n}'
        ),
      }),
      inline: ['t`Renamed`', 't`Star`', 't`Local`'],
    },
    'a tsconfig path': {
      files: (host, dir) => ({
        'page.tsx': withTag(
          host,
          'return getNavLabels(t);',
          `import { getNavLabels } from '@helpers/${dir}/lib/nav';`
        ),
        'lib/nav.ts': nav(
          host,
          'export function getNavLabels(t: GT) {\n  return t`Aliased`;\n}'
        ),
      }),
      inline: ['t`Aliased`'],
    },
    "a chain of files, resolving each import from the importing file's directory":
      {
        files: (host) => ({
          'page.tsx': withTag(
            host,
            'return outer(t);',
            "import { outer } from './lib/outer';"
          ),
          'lib/outer.ts': nav(
            host,
            "import { inner } from './inner';\nexport function outer(t: GT) {\n  return [t`Outer`, inner(t)];\n}"
          ),
          'lib/inner.ts': nav(
            host,
            'export function inner(t: GT) {\n  return t`Inner`;\n}'
          ),
        }),
        inline: ['t`Outer`', 't`Inner`'],
      },
    'an import cycle': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          'return ping(t, 3);',
          "import { ping } from './ping';"
        ),
        'ping.ts': nav(
          host,
          "import { pong } from './pong';\nexport function ping(t: GT, k: number): string {\n  return k ? pong(t, k - 1) : t`Ping`;\n}"
        ),
        'pong.ts': nav(
          host,
          "import { ping } from './ping';\nexport function pong(t: GT, k: number): string {\n  return k ? ping(t, k - 1) : t`Pong`;\n}"
        ),
      }),
      inline: ['t`Ping`', 't`Pong`'],
    },
    'message helpers and derive() in another file': {
      files: (host) => ({
        'page.tsx': withTag(
          host,
          "return count(t, 2, 'admin');",
          "import { count } from './count';"
        ),
        'count.ts': nav(
          host,
          "export function count(t: GT, items: number, role: 'admin' | 'member') {\n  return [\n    t`${plural({ items }, { one: 'One item', other: part`${n} items` })}`,\n    t`Signed in as ${derive(role)}`,\n  ];\n}"
        ),
      }),
      declarations:
        "declare const items: number;\ndeclare const role: 'admin' | 'member';",
      inline: [
        "t`${plural({ items }, { one: 'One item', other: part`${n} items` })}`",
        't`Signed in as ${derive(role)}`',
      ],
    },
  };

  async function expectInlineEntries(host: Host, testCase: Case) {
    const followed = await extractProject(host.library, (dir) =>
      testCase.files(host, dir)
    );
    const inline = await extractProject(host.library, () => ({
      'page.tsx': withTag(
        host,
        `return [${testCase.inline.join(', ')}];`,
        testCase.declarations
      ),
    }));

    expect(followed.result.errors).toEqual([]);
    expect(followed.result.warnings).toEqual([]);
    expect(inline.result.warnings).toEqual([]);
    expect(entryKeys(followed.result)).toEqual(entryKeys(inline.result));
    expect(entryKeys(followed.result).length).toBeGreaterThanOrEqual(
      testCase.inline.length
    );
  }

  it.each(Object.keys(cases))(
    'extracts %s like the same messages written inline',
    (name) => expectInlineEntries(nextHost, cases[name])
  );

  describe.each(hosts)('with %s', (_name, host) => {
    it.each([
      'a function declaration',
      'a named import',
      'message helpers and derive() in another file',
    ])('extracts %s like inline messages', (name) =>
      expectInlineEntries(host, cases[name])
    );
  });

  it("records the helper's file as the file of its messages", async () => {
    const { dir, result } = await extractProject(Libraries.GT_NEXT, () =>
      cases[
        "a chain of files, resolving each import from the importing file's directory"
      ].files(nextHost, '')
    );

    // Imports resolve to real paths, and the temporary directory may be a link.
    const relative = (file: string) =>
      path.relative(process.cwd(), path.join(fs.realpathSync(dir), file));
    expect(
      treeUpdates(result).map((u) => [u.source, u.metadata.filePaths])
    ).toEqual([
      ['Outer', [relative('lib/outer.ts')]],
      ['Inner', [relative('lib/inner.ts')]],
    ]);
  });

  it('extracts a function called from two components once', async () => {
    const component = (name: string) =>
      withTag(
        nextHost,
        'return [getNavLabels(t), getNavLabels(t), local(t), local(t)];',
        `import { getNavLabels } from './nav';\nfunction local(t: GT) {\n  return t\`Local ${name}\`;\n}`
      );
    const { result } = await extractProject(
      Libraries.GT_NEXT,
      () => ({
        'a.tsx': component('A'),
        'b.tsx': component('B'),
        'nav.ts': nav(
          nextHost,
          'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
        ),
      }),
      ['a.tsx', 'b.tsx']
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      'Settings',
      'Local A',
      'Local B',
    ]);
  });

  it('extracts a function called with the same options from two components once', async () => {
    const component = withTag(
      nextHost,
      "return [getNavLabels(t({ context: 'menu' })), getNavLabels(t({ context: 'menu' }))];",
      "import { getNavLabels } from './nav';"
    );
    const { result } = await extractProject(
      Libraries.GT_NEXT,
      () => ({
        'a.tsx': component,
        'b.tsx': component,
        'nav.ts': nav(
          nextHost,
          'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
        ),
      }),
      ['a.tsx', 'b.tsx'],
      { includeSourceCodeContext: true }
    );

    expect(result.warnings).toEqual([]);
    const updates = treeUpdates(result);
    expect(updates.map((u) => [u.source, u.metadata.context])).toEqual([
      ['Settings', 'menu'],
    ]);
    expect(
      Object.values(updates[0].metadata.sourceCode ?? {}).flat()
    ).toHaveLength(1);
  });

  it.each([
    ['useGT', 'return getNavLabels(useGT());'],
    ['getGT', 'return getNavLabels(await getGT());'],
  ])('follows the result of %s() passed directly', async (hook, body) => {
    const host = hosts.find(([, h]) => h.hook === hook)![1];
    const { result } = await extractProject(host.library, () => ({
      'page.tsx': withTag(host, body, "import { getNavLabels } from './nav';"),
      'nav.ts': nav(
        host,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
      ),
    }));

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Settings']);
  });

  it('follows a .js import to its .tsx source', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return getNavLabels(t);',
        "import { getNavLabels } from './nav.js';"
      ),
      'nav.tsx': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return <b>{t`Settings`}</b>;\n}'
      ),
    }));

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Settings']);
  });

  it("reports a bad option in the caller's file", async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return getNavLabels(t({ context: ctx }));',
        "import { getNavLabels } from './nav';\ndeclare const ctx: string;"
      ),
      'nav.ts': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
      ),
    }));

    expect(treeUpdates(result)).toEqual([]);
    const skipped = [...result.warnings, ...result.errors];
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatch(/page\.tsx \(\d+:\d+\)/);
    expect(skipped[0]).not.toMatch(/nav\.ts/);
  });

  it('follows type assertions, a self-calling function expression, an overloaded default export and .mjs imports', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        [
          'asserted(t as GT);',
          'asserted(t!);',
          'asserted(t satisfies GT);',
          'self(t, 1);',
          'overloaded(t);',
          'return fromMts(t);',
        ].join('\n  '),
        [
          "import overloaded from './overloaded';",
          "import { fromMts } from './labels.mjs';",
          'function asserted(t: GT) {\n  return t`Asserted`;\n}',
          'const self = function inner(t: GT, depth: number): string {\n  return depth ? inner(t, depth - 1) : t`Self`;\n};',
        ].join('\n')
      ),
      'overloaded.ts': nav(
        nextHost,
        'export default function label(t: GT): string;\nexport default function label(t: GT, id?: string) {\n  return t`Overloaded`;\n}'
      ),
      'labels.mts': nav(
        nextHost,
        'export function fromMts(t: GT) {\n  return t`From mts`;\n}'
      ),
    }));

    expect(result.warnings).toEqual([]);
    expect(
      treeUpdates(result)
        .map((u) => u.source)
        .sort()
    ).toEqual(['Asserted', 'From mts', 'Overloaded', 'Self']);
  });

  it('extracts a helper once when its own file and another file pass it t', async () => {
    const { result } = await extractProject(
      Libraries.GT_NEXT,
      () => ({
        'a.tsx': withTag(
          nextHost,
          'return getNavLabels(t);',
          "import { getNavLabels } from './nav';"
        ),
        'nav.tsx': withTag(
          nextHost,
          'return getNavLabels(t);',
          'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
        ),
      }),
      ['a.tsx', 'nav.tsx'],
      { includeSourceCodeContext: true }
    );

    expect(result.warnings).toEqual([]);
    const updates = treeUpdates(result);
    expect(updates.map((u) => u.source)).toEqual(['Settings']);
    expect(
      Object.values(updates[0].metadata.sourceCode ?? {}).flat()
    ).toHaveLength(1);
  });

  it('follows an export through a large barrel', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => {
      const files: Record<string, string> = {
        'page.tsx': withTag(
          nextHost,
          'return getNavLabels(t);',
          "import { getNavLabels } from './lib';"
        ),
        'lib/nav.ts': nav(
          nextHost,
          'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
        ),
      };
      const modules = Array.from({ length: 40 }, (_, i) => `m${i}`);
      for (const name of modules) {
        files[`lib/${name}.ts`] =
          `export function ${name}() {\n  return '${name}';\n}\n`;
      }
      files['lib/index.ts'] = [...modules, 'nav']
        .map((name) => `export * from './${name}';`)
        .join('\n');
      return files;
    });

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Settings']);
  });

  it('warns about an import it cannot resolve because tsconfig.json is malformed', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'tsconfig.json': '{ "compilerOptions": { "strict": true, }} oops',
      'page.tsx': withTag(
        nextHost,
        'return getNavLabels(t);',
        "import { getNavLabels } from './nav';"
      ),
      'nav.ts': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
      ),
    }));

    expect(treeUpdates(result)).toEqual([]);
    expect(
      result.warnings.filter((w) => w.includes('Could not follow this use'))
    ).toHaveLength(1);
  });

  it('extracts and warns about a reassigned default export, and warns about arguments read beside a parameter', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        [
          'reassigned(t);',
          'inDefault(undefined, t);',
          'return besideParameter(t);',
        ].join('\n  '),
        [
          "import reassigned from './reassigned';",
          'function inDefault(tr: GT = arguments[1]) {\n  return tr`In default`;\n}',
          'function besideParameter(tr: GT) {\n  return (arguments[0] as GT)`Beside`;\n}',
        ].join('\n')
      ),
      'reassigned.ts': nav(
        nextHost,
        'export default function label(t: GT) {\n  return t`Old`;\n}\nlabel = (t: GT) => t`New`;'
      ),
    }));

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Old']);
    const untracked = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    expect(untracked).toHaveLength(3);
  });

  it('extracts a function once for the same options written in another order', async () => {
    const { result } = await extractProject(
      Libraries.GT_NEXT,
      () => ({
        'page.tsx': withTag(
          nextHost,
          "return [getNavLabels(t({ context: 'menu', maxChars: 9 })), getNavLabels(t({ maxChars: 9, context: 'menu' }))];",
          "import { getNavLabels } from './nav';"
        ),
        'nav.ts': nav(
          nextHost,
          'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
        ),
      }),
      ['page.tsx'],
      { includeSourceCodeContext: true }
    );

    expect(result.warnings).toEqual([]);
    const updates = treeUpdates(result);
    expect(updates.map((u) => u.source)).toEqual(['Settings']);
    expect(
      Object.values(updates[0].metadata.sourceCode ?? {}).flat()
    ).toHaveLength(1);
  });

  it('reports invalid options at every call site, including t()', async () => {
    const caller = (body: string) =>
      withTag(
        nextHost,
        body,
        "import { getNavLabels } from './nav';\ndeclare const ctx: string;"
      );
    const { result } = await extractProject(
      Libraries.GT_NEXT,
      () => ({
        'a.tsx': caller('return getNavLabels(t({ context: ctx }));'),
        'b.tsx': caller('return getNavLabels(t({ context: ctx }));'),
        'c.tsx': caller('return getNavLabels(t());'),
        'nav.ts': nav(
          nextHost,
          'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
        ),
      }),
      ['a.tsx', 'b.tsx', 'c.tsx']
    );

    expect(treeUpdates(result)).toEqual([]);
    const skipped = [...result.warnings, ...result.errors];
    expect(skipped).toHaveLength(3);
    expect(
      skipped.map((w) => w.match(/\b([abc])\.tsx \(/)?.[1]).sort()
    ).toEqual(['a', 'b', 'c']);
    expect(skipped.join('\n')).not.toMatch(/nav\.ts/);
  });

  it('follows let and var aliases, array literal spreads, and hook dependency arrays without warning', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        [
          'let tr = t;',
          'var label = useCallback(() => tr`Callback`, [tr]);',
          'useMemo(() => viaLet(t), [t]);',
          'return [label, spread(...[1, 2], t)];',
        ].join('\n  '),
        [
          "import { useCallback, useMemo } from 'react';",
          'function viaLet(t: GT) {\n  let inner = t;\n  return inner`Let alias`;\n}',
          'function spread(a: number, b: number, t: GT) {\n  return t`Spread`;\n}',
        ].join('\n')
      ),
    }));

    expect(result.warnings).toEqual([]);
    expect(
      treeUpdates(result)
        .map((u) => u.source)
        .sort()
    ).toEqual(['Callback', 'Let alias', 'Spread']);
  });

  it('follows type assertions around the hook result and a configured tag', async () => {
    const getHost = hosts.find(([, h]) => h.hook === 'getGT')![1];
    const files = (host: Host, body: string) => () => ({
      'page.tsx': withTag(host, body, "import { label } from './nav';"),
      'nav.ts': nav(
        host,
        'export function label(t: GT) {\n  return t`Save`;\n}'
      ),
    });
    for (const [host, body, context] of [
      [nextHost, 'return label(useGT() as GT);', undefined],
      [getHost, 'return label((await getGT()) as GT);', undefined],
      [nextHost, "return label(t({ context: 'nav' })!);", 'nav'],
    ] as const) {
      const { result } = await extractProject(host.library, files(host, body));
      expect(result.warnings).toEqual([]);
      expect(
        treeUpdates(result).map((u) => [u.source, u.metadata.context])
      ).toEqual([['Save', context]]);
    }
  });

  it('keeps inline messages when an imported file cannot be traversed', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return [t`Inline`, label(t)];',
        "import { label } from './nav';"
      ),
      'types.ts': 'export interface State {\n  ready: boolean;\n}\n',
      'nav.ts':
        "import type { State } from './types';\nlet State: State = { ready: true };\nexport function label(t: any) {\n  return t`Save`;\n}\n",
    }));

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Inline']);
    expect(
      result.warnings.filter((w) => w.includes('Could not follow this use'))
    ).toHaveLength(1);
  });

  it('reads a followed helper file at most twice across many callers', async () => {
    const helpers = Array.from({ length: 12 }, (_, i) => `h${i}`);
    const pages = Array.from({ length: 6 }, (_, i) => `page${i}.tsx`);
    const reads = vi.spyOn(fs, 'readFileSync');
    try {
      const { result } = await extractProject(
        Libraries.GT_NEXT,
        () => {
          const files: Record<string, string> = {};
          for (const page of pages) {
            files[page] = withTag(
              nextHost,
              `return [${helpers.map((h) => `${h}(t)`).join(', ')}];`,
              helpers.map((h) => `import { ${h} } from './${h}';`).join('\n')
            );
          }
          for (const h of helpers) {
            files[`${h}.ts`] = nav(
              nextHost,
              `export function ${h}(t: GT) {\n  return t\`${h}\`;\n}`
            );
          }
          return files;
        },
        pages
      );

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result)).toHaveLength(helpers.length);
      const helperReads = reads.mock.calls
        .map(([file]) => path.basename(String(file)))
        .filter((file) => /^h\d+\.ts$/.test(file));
      for (const h of helpers) {
        expect(
          helperReads.filter((file) => file === `${h}.ts`).length
        ).toBeLessThanOrEqual(2);
      }
    } finally {
      reads.mockRestore();
    }
  });

  it('reports invalid options of a configured alias at the t() call', async () => {
    const { dir, result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'const tag = t();\n\n  return getNavLabels(tag);',
        "import { getNavLabels } from './nav';"
      ),
      'nav.ts': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
      ),
    }));

    const lines = fs
      .readFileSync(path.join(dir, 'page.tsx'), 'utf8')
      .split('\n');
    const configuredLine =
      lines.findIndex((line) => line.includes('const tag = t()')) + 1;
    const skipped = [...result.warnings, ...result.errors];
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain(`page.tsx (${configuredLine}:`);
  });

  it('stops at an alias cycle that var redeclarations create', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return label(t);',
        'function label(t: GT) {\n  var alias = t;\n  // @ts-ignore\n  var t = alias;\n  return t`Save`;\n}'
      ),
    }));

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Save']);

    const { result: chain } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        '// @ts-ignore\n  var tr = t;\n  // @ts-ignore\n  var copy = tr;\n  // @ts-ignore\n  var tr = copy;\n  return tr`Chain`;'
      ),
    }));

    expect(treeUpdates(chain).map((u) => u.source)).toEqual(['Chain']);
  });

  it('follows the same barrel through two symlinked paths to different helpers', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, (dir) => {
      const root = path.join(projectDir, dir);
      fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'shared/barrel.ts'),
        "export { label } from './impl';\n"
      );
      for (const name of ['a', 'b']) {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.symlinkSync(
          path.join(root, 'shared/barrel.ts'),
          path.join(root, name, 'barrel.ts')
        );
      }
      return {
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            preserveSymlinks: true,
            paths: { '@a': ['a/barrel.ts'], '@b': ['b/barrel.ts'] },
          },
        }),
        'a/impl.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  return t`A`;\n}'
        ),
        'b/impl.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  return t`B`;\n}'
        ),
        'page.tsx': withTag(
          nextHost,
          'b(t);\n  return a(t);',
          "import { label as a } from '@a';\nimport { label as b } from '@b';"
        ),
      };
    });

    expect(result.warnings).toEqual([]);
    expect(
      treeUpdates(result)
        .map((u) => u.source)
        .sort()
    ).toEqual(['A', 'B']);
  });

  it("warns about a tag in a custom hook's array argument", async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        "return useLabels('menu', [t]);",
        'declare function useLabels(id: string, tags: GT[]): string;'
      ),
    }));

    expect(
      result.warnings.filter((w) => w.includes('Could not follow this use'))
    ).toHaveLength(1);
  });

  it.each([
    ['configured first', 'label(t({}), false);\n  return label(t, true);'],
    ['unconfigured first', 'label(t, true);\n  return label(t({}), false);'],
  ])(
    'follows an unconfigured and a configured tag separately, %s',
    async (_, body) => {
      const { result } = await extractProject(Libraries.GT_NEXT, () => ({
        'page.tsx': withTag(
          nextHost,
          body,
          "function label(tr: GT, withContext: boolean) {\n  return withContext ? tr({ context: 'nav' })`Settings` : tr`Home`;\n}"
        ),
      }));

      expect(
        treeUpdates(result)
          .map((u) => [u.source, u.metadata.context])
          .sort()
      ).toEqual([
        ['Home', undefined],
        ['Settings', 'nav'],
      ]);
    }
  );

  it.each([
    ['useGT', 'const t = useGT() as GT;\n  return label(t);', undefined],
    [
      'useGT',
      'const t = useGT();\n  const tr = t as GT;\n  return label(tr);',
      undefined,
    ],
    [
      'useGT',
      "const t = useGT();\n  const tag = t({ context: 'nav' })!;\n  return label(tag);",
      'nav',
    ],
    ['getGT', 'const t = (await getGT())!;\n  return label(t);', undefined],
    ['getGT', 'return label(await getGT()!);', undefined],
    ['getGT', 'return label((await getGT())!);', undefined],
  ])(
    'extracts the same entry when a %s tag is bound through an assertion: %s',
    async (hook, body, context) => {
      const host = hosts.find(([, h]) => h.hook === hook)![1];
      const component =
        hook === 'useGT'
          ? `export function Component() {\n  ${body}\n}`
          : `export async function load() {\n  ${body}\n}`;
      const { result } = await extractProject(host.library, () => ({
        'page.tsx': `import { ${hook}, type GT } from '${host.source}';\nimport { label } from './nav';\n${component}\n`,
        'nav.ts': nav(
          host,
          'export function label(t: GT) {\n  return t`Save`;\n}'
        ),
      }));

      expect(result.warnings).toEqual([]);
      expect(
        treeUpdates(result).map((u) => [u.source, u.metadata.context])
      ).toEqual([['Save', context]]);
    }
  );

  it('stops at a var alias initialized from itself', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        '// @ts-ignore\n  var tr = t;\n  // @ts-ignore\n  var tr = tr;\n  return tr`Self`;'
      ),
    }));

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Self']);
  });

  it('extracts the configured message of a var that redeclares the parameter', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return label(t);',
        "function label(t: GT) {\n  // @ts-ignore\n  var t = t({ context: 'nav' });\n  return t`Save`;\n}"
      ),
    }));

    expect(
      treeUpdates(result).map((u) => [u.source, u.metadata.context])
    ).toContainEqual(['Save', 'nav']);
  });

  it('recognizes React hooks by their import, not their local name', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        [
          'const a = useCached(() => t`Cached`, [t]);',
          'const b = React.useCallback(() => t`Namespaced`, [t]);',
          "return [a, b, helpers.useMemo('nav', [t])];",
        ].join('\n  '),
        [
          "import { useMemo as useCached } from 'react';",
          "import * as React from 'react';",
          'declare const helpers: { useMemo(id: string, tags: GT[]): string };',
        ].join('\n')
      ),
    }));

    expect(
      treeUpdates(result)
        .map((u) => u.source)
        .sort()
    ).toEqual(['Cached', 'Namespaced']);
    const untracked = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    // Only the [t] passed to helpers.useMemo, on the component's third line.
    expect(untracked.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual(['9']);
  });

  it('follows a symlinked helper that forwards t to a relative import, from each path', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, (dir) => {
      const root = path.join(projectDir, dir);
      fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'shared/relay.ts'),
        "import { label } from './impl';\nexport function relay(t: any) {\n  return label(t);\n}\n"
      );
      for (const name of ['a', 'b']) {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.symlinkSync(
          path.join(root, 'shared/relay.ts'),
          path.join(root, name, 'relay.ts')
        );
      }
      return {
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            preserveSymlinks: true,
            paths: { '@a': ['a/relay.ts'], '@b': ['b/relay.ts'] },
          },
        }),
        'a/impl.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  return t`A`;\n}'
        ),
        'b/impl.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  return t`B`;\n}'
        ),
        'page.tsx': withTag(
          nextHost,
          'b(t);\n  return a(t);',
          "import { relay as a } from '@a';\nimport { relay as b } from '@b';"
        ),
      };
    });

    expect(result.warnings).toEqual([]);
    expect(
      treeUpdates(result)
        .map((u) => u.source)
        .sort()
    ).toEqual(['A', 'B']);
  });

  it('reads <GT> assertions in .ts files, in the caller and the helper', async () => {
    const { result } = await extractProject(
      Libraries.GT_NEXT,
      () => ({
        'page.ts': `import { useGT, type GT } from 'gt-next';\nimport { label } from './nav';\nexport function useLabel() {\n  const t = <GT>useGT();\n  return label(t);\n}\n`,
        'nav.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  const tr = <GT>t;\n  return tr`Save`;\n}'
        ),
      }),
      ['page.ts']
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Save']);
  });

  it('follows a symlinked directory to the files beside each link', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, (dir) => {
      const root = path.join(projectDir, dir);
      fs.mkdirSync(path.join(root, 'real/shared'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'real/shared/index.ts'),
        "export { label } from '../impl';\n"
      );
      for (const name of ['a', 'b']) {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.symlinkSync(
          path.join(root, 'real/shared'),
          path.join(root, name, 'shared'),
          'dir'
        );
      }
      return {
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            preserveSymlinks: true,
            paths: { '@a': ['a/shared/index.ts'], '@b': ['b/shared/index.ts'] },
          },
        }),
        'a/impl.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  return t`A`;\n}'
        ),
        'b/impl.ts': nav(
          nextHost,
          'export function label(t: GT) {\n  return t`B`;\n}'
        ),
        'page.tsx': withTag(
          nextHost,
          'b(t);\n  return a(t);',
          "import { label as a } from '@a';\nimport { label as b } from '@b';"
        ),
      };
    });

    expect(result.warnings).toEqual([]);
    expect(
      treeUpdates(result)
        .map((u) => u.source)
        .sort()
    ).toEqual(['A', 'B']);
  });

  it("recognizes React's default export imported by name", async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return R.useMemo(() => t`Save`, [t]);',
        "import { default as R } from 'react';"
      ),
    }));

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Save']);
  });

  it('extracts a gt-svelte module in a .ts file with a <T> assertion', async () => {
    const { result } = await extractProject(
      Libraries.GT_SVELTE,
      () => ({
        'labels.ts':
          "import { msg } from 'gt-svelte';\nconst count = <number>1;\nexport const save = msg('Save');\n",
      }),
      ['labels.ts']
    );

    expect(result.errors).toEqual([]);
    expect(result.updates.map((u) => u.source)).toContain('Save');
  });

  it('skips a scanned file whose scopes Babel cannot build, and extracts the rest', async () => {
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { result } = await extractProject(
      Libraries.GT_REACT,
      () => ({
        'types.ts': 'export interface State {\n  ready: boolean;\n}\n',
        'state.ts':
          "import type { State } from './types';\nlet State = <State>{ ready: true };\nexport { State };\n",
        'label.ts':
          "import { t } from 'gt-react';\nexport const label = t`Save`;\n",
      }),
      ['state.ts', 'label.ts']
    );

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Save']);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('state.ts'));
    logged.mockRestore();
  });

  it('does not extract a function that never receives a tag', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        'return [getInfo(other), unused];',
        "declare const other: GT;\nfunction getInfo(t: GT) {\n  return t`Passed another t`;\n}\nfunction unused(t: GT) {\n  return t`Never called`;\n}\nimport { getNavLabels } from './nav';\ngetNavLabels(other);"
      ),
      'nav.ts': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
      ),
    }));

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result)).toEqual([]);
  });

  it('warns about the t imported from gt-react passed to a function', async () => {
    const { result } = await extractProject(Libraries.GT_REACT, () => ({
      'page.tsx':
        "import { t, type GT } from 'gt-react';\nimport { getNavLabels } from './nav';\nfunction local(tr: GT) {\n  return tr`Local`;\n}\ngetNavLabels(t);\nlocal(t);\n",
      'nav.ts': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}'
      ),
    }));

    expect(treeUpdates(result)).toEqual([]);
    const untracked = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    expect(untracked.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '6',
      '7',
    ]);
  });

  it('extracts and warns about a reassigned function, and warns about one that reads arguments', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        [
          'reassigned(t);',
          'viaArguments(t);',
          'arrowReads(t);',
          'return nestedReads(t);',
        ].join('\n  '),
        [
          'function reassigned(t: GT) {\n  return t`Old`;\n}',
          'reassigned = (t: GT) => t`New`;',
          'function viaArguments() {\n  const tr: GT = arguments[0];\n  return tr`Via arguments`;\n}',
          'function arrowReads() {\n  const read = () => arguments[0];\n  return read()`Arrow`;\n}',
          'function nestedReads() {\n  return function () {\n    return arguments[0];\n  };\n}',
        ].join('\n')
      ),
    }));

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Old']);
    const untracked = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    expect(untracked.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '21',
      '22',
      '23',
    ]);
  });

  it('warns about a function it cannot find, and extracts the rest', async () => {
    const { result } = await extractProject(Libraries.GT_NEXT, () => ({
      'page.tsx': withTag(
        nextHost,
        [
          'missing(t);',
          'fromPackage(t);',
          'helpers.label(t);',
          "helpers['label'](t);",
          '(Math.random() ? helpers.label : helpers.label)(t);',
          'getNavLabels(...args, t);',
          'rest(t);',
          'destructured({ t });',
          'notAFunction(t);',
          'Translate(t);',
          'return getNavLabels(t);',
        ].join('\n  '),
        [
          "import { missing } from './missing';",
          "import { label as fromPackage } from 'fake-helpers';",
          "import { T as Translate } from 'gt-react';",
          "import { getNavLabels, notAFunction } from './nav';",
          'declare const helpers: { label(t: GT): string };',
          'declare const args: GT[];',
          'function rest(...all: GT[]) {\n  return all[0]`Rest`;\n}',
          'function destructured({ t }: { t: GT }) {\n  return t`Destructured`;\n}',
        ].join('\n')
      ),
      'nav.ts': nav(
        nextHost,
        'export function getNavLabels(t: GT) {\n  return t`Settings`;\n}\nexport const notAFunction = getNavLabels.bind(null);'
      ),
      'node_modules/fake-helpers/package.json': JSON.stringify({
        name: 'fake-helpers',
        main: 'index.js',
      }),
      'node_modules/fake-helpers/index.js':
        'export function label(t) {\n  return t`From a package`;\n}\n',
    }));

    expect(treeUpdates(result).map((u) => u.source)).toEqual(['Settings']);
    const untracked = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    expect(untracked.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
      '24',
      '25',
    ]);
  });
});
