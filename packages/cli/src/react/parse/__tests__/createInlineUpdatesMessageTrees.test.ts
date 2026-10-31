import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildMessageTree } from '@generaltranslation/icu';
import { hashMessageTree } from 'generaltranslation/id';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { Libraries, type GTLibrary } from '../../../types/libraries.js';
import type { GTParsingFlags } from '../../../types/parsing.js';
import { matchFiles } from '../../../fs/matchFiles.js';
import wireFormatCases from '../../../../../../test-fixtures/icu-tree-wire-format.json' with { type: 'json' };

vi.mock('../../../fs/matchFiles.js', () => ({ matchFiles: vi.fn() }));

const UNSTABLE_HELPERS =
  't, useGT, getGT, plural, selectordinal, select, number, date, part, derive, n';

// The fixtures' free variables, typed as in fixtureParity.test.ts: the CLI
// skips an undeclared value, since TypeScript types it any.
const FIXTURE_VALUES =
  'declare const first: string, second: string, count: number, role: string, price: number, due: Date;';

// The CLI reads value types with TypeScript, so every /unstable import in the
// project resolves to the real gt-i18n/unstable types.
const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-message-tree-'));
const i18nUnstable = path.resolve(
  import.meta.dirname,
  '../../../../../i18n/src/unstable'
);
fs.writeFileSync(
  path.join(projectDir, 'unstable.d.ts'),
  `export * from '${i18nUnstable}';
import type { GT } from '${i18nUnstable}';
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
      paths: { 'gt-*': ['./unstable.d.ts'] },
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
      paths: { 'gt-*': ['../unstable.d.ts'] },
    },
  })
);

const tempFiles: string[] = [];

afterEach(() => {
  for (const file of tempFiles) fs.rmSync(file, { force: true });
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
  result.updates.filter((update) => update.dataFormat === 'ICU_TREE');

describe('createInlineUpdates: unstable tagged templates', () => {
  // `gt` in each fixture template becomes the tag under test.
  const forms: Record<string, (template: string) => string> = {
    t: (template) => template.replace(/^gt/, 't'),
    useGT: (template) =>
      `export function Component() {\n  const gt = useGT();\n  return ${template};\n}`,
    getGT: (template) =>
      `export async function load() {\n  const gt = await getGT();\n  return ${template};\n}`,
  };

  describe.each(Object.keys(forms))('fixture parity via %s', (form) => {
    it.each(wireFormatCases.map((testCase) => [testCase.name, testCase]))(
      '%s',
      async (_name, testCase) => {
        const result = await extract(
          `import { ${UNSTABLE_HELPERS} } from 'gt-i18n/unstable';\n${FIXTURE_VALUES}\n${forms[form](testCase.template)};\n`
        );

        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.updates).toHaveLength(1);
        const [update] = result.updates;
        expect(update.dataFormat).toBe('ICU_TREE');
        expect(update.source).toEqual(testCase.tree);
        expect(update.metadata.hash).toBe(testCase.hash);
      }
    );
  });

  it('routes gt-react/unstable t and useGT to the tree path only', async () => {
    const result = await extract(`
      import { t, useGT } from 'gt-react/unstable';
      import { t as legacyT, useGT as useLegacyGT } from 'gt-react';
      export function Component({ name }) {
        const gt = useGT();
        const legacy = useLegacyGT();
        legacy('Hello, world!');
        legacyT\`Hello, \${name}!\`;
        gt({ context: 'button' })\`Save\`;
        return t\`Hello, \${{ name }}!\`;
      }
    `);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(
      result.updates.filter((u) => u.dataFormat === 'ICU').map((u) => u.source)
    ).toEqual(expect.arrayContaining(['Hello, world!', 'Hello, {0}!']));
    expect(treeUpdates(result).map((u) => u.metadata.context)).toEqual(
      expect.arrayContaining(['button', undefined])
    );
    expect(result.updates).toHaveLength(4);
  });

  it('stores maxChars and requiresReview options in metadata and the hash', async () => {
    const result = await extract(`
      import { t } from 'gt-react/unstable';
      t({ maxChars: -12, requiresReview: true, locale: 'fr' })\`Read more\`;
    `);

    const [update] = treeUpdates(result);
    expect(update.metadata).toMatchObject({
      maxChars: 12,
      requiresReview: true,
    });
    expect(update.metadata.hash).toBe(
      hashMessageTree(['Read more'], {
        maxChars: 12,
        requiresReview: true,
      })
    );
  });

  it('follows aliased imports and same-file const part references', async () => {
    const result = await extract(`
      import { t as translate, plural as p, part as fragment, n as pound } from 'gt-react/unstable';
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
      import { t, derive } from 'gt-react/unstable';
      const isMorning = Math.random() > 0.5;
      t\`Good \${derive(isMorning ? 'morning' : 'evening')}\`;
    `);

    const updates = treeUpdates(result);
    expect(updates.map((u) => u.source)).toEqual([
      ['Good evening'],
      ['Good morning'],
    ]);
    expect(updates[0].metadata.staticId).toBeTruthy();
    expect(updates[0].metadata.staticId).toBe(updates[1].metadata.staticId);
  });

  it('skips non-static messages with a warning and keeps extracting', async () => {
    const result = await extract(`
      import { t, plural, derive } from 'gt-react/unstable';
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
      ['Still extracted'],
    ]);
    const skipped = result.warnings.filter((warning) =>
      warning.includes('Skipped a tagged-template message')
    );
    expect(skipped).toHaveLength(6);
    expect(skipped.join('\n')).toMatch(/\(5:\d+\)/);
    expect(skipped.join('\n')).toContain('built outside the template');
  });

  it('ignores unstable sources outside the configured library', async () => {
    const result = await extract(
      `import { t } from 'gt-react/unstable';\nt\`Hello\`;\n`,
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
        `import { t, derive } from 'gt-react/unstable';\n${code}\nt\`Still extracted\`;\n`
      );

      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        ['Still extracted'],
      ]);
      expect(result.warnings.join('\n')).toContain(
        'the derive() value is typed as any string'
      );
    });

    // A host such as getValidateJson() can extract twice in one process.
    it('reads the types of an edited file on the next run', async () => {
      const header = `import { t, derive } from 'gt-react/unstable';\ndeclare const txt: string;\n`;
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

      expect(treeUpdates(await run()).map((u) => u.source)).toEqual([['A']]);
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
        import { t, derive } from 'gt-react/unstable';
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
        import { t, derive } from 'gt-react/unstable';
        function label(user?: { name: string }) {
          if (!user) return 'Guest';
          return 'Member';
        }
        t\`Signed in as \${derive(label())}\`;
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        ['Signed in as Guest'],
        ['Signed in as Member'],
      ]);
    });

    it('extracts an as const lookup imported from another file', async () => {
      const labels = writeModule(
        "export const labels = { admin: 'Admin', member: 'Member' } as const;\n",
        'ts'
      );
      const result = await extract(`
        import { t, derive } from 'gt-react/unstable';
        import { labels } from '${labels}';
        declare const role: keyof typeof labels;
        t\`\${derive(labels[role])}\`;
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        ['Admin'],
        ['Member'],
      ]);
    });

    it('hashes derived text like text written in the template', async () => {
      const [derived] = treeUpdates(
        await extract(
          "import { t, derive } from 'gt-react/unstable';\nt`Hello ${derive('world')}`;\n"
        )
      );
      const [written] = treeUpdates(
        await extract(
          "import { t } from 'gt-react/unstable';\nt`Hello world`;\n"
        )
      );

      expect(derived.source).toEqual(['Hello world']);
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
      `import { t, plural, number, part, select, n } from 'gt-react/unstable';\n${code}\n`
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
      `import { t, plural, part, n } from 'gt-react/unstable';\n${code}\n`
    );

    expect(treeUpdates(result)).toEqual([]);
    expect(result.warnings.join('\n')).toContain(warning);
  });

  it('reads branches wrapped in type assertions', async () => {
    const result = await extract(
      "import { t, select, part } from 'gt-react/unstable';\nt`${select({ s }, { a: 'A' as const, b: part`B` satisfies object, other: 'C'! })}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result)).toHaveLength(1);
  });

  it('reads a destructured value as an anonymous value', async () => {
    const result = await extract(
      "import { t } from 'gt-react/unstable';\nconst { name } = { name: 'Ada' };\nt`Hi ${name}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Hi ', ['_gt_1']],
    ]);
  });

  it('reads a value typed as a template literal type as an anonymous value', async () => {
    const result = await extract(
      "import { t } from 'gt-react/unstable';\ndeclare const id: `id-${string}`;\nt`Item ${id}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Item ', ['_gt_1']],
    ]);
  });

  it('reads a type-asserted object as a named variable', async () => {
    const result = await extract(
      "import { t } from 'gt-react/unstable';\nt`Hi ${{ name } as const}`;\n"
    );

    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Hi ', ['name']],
    ]);
  });

  it('reads a Date subclass passed to date()', async () => {
    const result = await extract(
      "import { t, date } from 'gt-react/unstable';\nclass CustomDate extends Date {}\nconst due = new CustomDate(0);\nt`Due ${date(due)}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Due ', ['_gt_1', 'date']],
    ]);
  });

  it('reads a generic Date subclass passed to date()', async () => {
    const result = await extract(
      "import { t, date } from 'gt-react/unstable';\nclass CustomDate<T> extends Date { extra?: T }\nt`Due ${date(new CustomDate<number>(0))}`;\n"
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Due ', ['_gt_1', 'date']],
    ]);
  });

  // The runtime names an object's key, so `any` could be `{ name }`.
  it('skips a value typed any, whose shape is unknown', async () => {
    const result = await extract(
      'import { t } from \'gt-react/unstable\';\nconst hole = JSON.parse(\'{"name":"Ada"}\');\nt`Hi ${hole}`;\n'
    );

    expect(treeUpdates(result)).toEqual([]);
    expect(result.warnings.join('\n')).toContain('any, unknown');
  });

  it('skips a bare Date, which needs date() to be formatted', async () => {
    const result = await extract(
      "import { t } from 'gt-react/unstable';\ndeclare const due: Date | string;\nt`Due ${due}`;\n"
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
      "import { t, derive } from 'gt-react/unstable';\ndeclare const flag: boolean;\nconst labels = flag ? { text: 'A' as const } : {};\nt`Label ${derive((labels as { text: 'A' }).text)}`;\n",
      Libraries.GT_NEXT,
      {} as GTParsingFlags,
      looseDir
    );

    expect(result.warnings).toEqual([]);
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Label '],
      ['Label A'],
    ]);
  });

  // Both APIs export derive(), so an editor can auto-import the wrong one.
  describe('helpers mixed between gt() and unstable messages', () => {
    it.each([
      ['inline', '`dear ${declareVar(name)}`'],
      ['through a function', 'label(name)'],
    ])(
      'skips an unstable message with a legacy declareVar() %s',
      async (_how, argument) => {
        const result = await extract(`
          import { t, derive } from 'gt-react/unstable';
          import { declareVar } from 'gt-react';
          function label(name) { return \`dear \${declareVar(name)}\`; }
          t\`Hi \${derive(${argument})}\`;
        `);

        expect(treeUpdates(result)).toEqual([]);
        expect(result.warnings.join('\n')).toContain(
          'the derive() value is typed as any string'
        );
      }
    );

    it('names the legacy import of a helper used in an unstable message', async () => {
      const result = await extract(`
        import { t } from 'gt-react/unstable';
        import { derive } from 'gt-react';
        t\`Role: \${derive(admin ? 'admin' : 'guest')}\`;
      `);

      expect(treeUpdates(result)).toEqual([]);
      expect(result.warnings.join('\n')).toContain(
        'derive() is imported from gt-react, which only works with gt() messages'
      );
    });

    it.each([
      [
        'an unstable derive()',
        "import { derive } from 'gt-react/unstable';",
        'gt(`Role: ${derive(admin ? "a" : "b")}`)',
        'derive()',
      ],
    ])('reports %s in a gt() message', async (_name, imports, call, helper) => {
      const result = await extract(`
        import { useGT } from 'gt-react';
        ${imports}
        export function Component({ name, admin }) {
          const gt = useGT();
          return ${call};
        }
      `);

      expect(result.updates).toEqual([]);
      expect(result.errors.join('\n')).toContain(
        `${helper} is imported from an unstable entry, which only works inside tagged gt\`...\` messages`
      );
    });
  });

  describe('tag aliases', () => {
    it('follows const aliases of t and gt', async () => {
      const result = await extract(`
        import { t, useGT } from 'gt-react/unstable';
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
        ['Hello'],
        ['Bye'],
      ]);
    });

    it('applies the options of a configured tag', async () => {
      const result = await extract(`
        import { t, useGT } from 'gt-react/unstable';
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
        hashMessageTree(['Save'], { context: 'button' }),
        hashMessageTree(['Open'], { maxChars: 4 }),
      ]);
    });

    it('warns about uses it cannot follow', async () => {
      const result = await extract(`
        import { t, useGT } from 'gt-react/unstable';
        register(t);
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
        ['Still extracted'],
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

  it('skips a reserved variable name with a warning and keeps extracting', async () => {
    const result = await extract(`
      import { t } from 'gt-react/unstable';
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
      ['Still extracted'],
    ]);
  });

  describe('a variable formatted two ways', () => {
    it('skips the message with a warning and keeps extracting', async () => {
      const result = await extract(`
        import { t, date, select, part } from 'gt-react/unstable';
        t\`\${date({ d }, { dateStyle: 'short' })} / \${date({ d }, { dateStyle: 'long' })}\`;
        t\`\${date({ d })} \${select({ r }, { a: part\`\${date({ d }, { dateStyle: 'long' })}\`, other: '' })}\`;
        t\`Still extracted\`;
      `);

      const conflicts = result.warnings.filter((w) =>
        w.includes('is formatted two different ways')
      );
      expect(conflicts.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
        '3',
        '4',
      ]);
      expect(conflicts[0]).toContain('"d"');
      expect(treeUpdates(result).map((u) => u.source)).toEqual([
        ['Still extracted'],
      ]);
    });

    it.each([
      [
        'identical options',
        "t`${date({ d }, { dateStyle: 'short', timeStyle: 'short' })} ${date({ d }, { timeStyle: 'short', dateStyle: 'short' })}`",
      ],
      ['an argument and a number', 't`${{ n }} (${number({ n })})`'],
    ])('extracts a name reused with %s', async (_name, message) => {
      const result = await extract(`
        import { t, date, number } from 'gt-react/unstable';
        ${message};
      `);

      expect(result.warnings).toEqual([]);
      expect(treeUpdates(result)).toHaveLength(1);
    });
  });

  it('skips a message with too many variants instead of expanding it', async () => {
    const branches = Array.from({ length: 20 }, (_, i) => `b${i}: shared`).join(
      ', '
    );
    const result = await extract(`
      import { t, part, select, derive } from 'gt-react/unstable';
      const shared = part\`\${derive(flag ? 'Ready' : 'Waiting')}\`;
      t\`\${select({ status }, { ${branches}, other: 'Other' })}\`;
      t\`Still extracted\`;
    `);

    expect(result.warnings.join('\n')).toContain('variants');
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Still extracted'],
    ]);
  });

  it('skips one derive() with too many variants', async () => {
    const result = await extract(`
      import { t, derive } from 'gt-react/unstable';
      type D = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'x';
      declare const code: \`\${D}\${D}\${D}\`;
      t\`\${derive(code)}\`;
      t\`Still extracted\`;
    `);

    expect(result.warnings.join('\n')).toContain('variants');
    expect(treeUpdates(result).map((u) => u.source)).toEqual([
      ['Still extracted'],
    ]);
  });

  it('warns about require() and import() of unstable sources', async () => {
    const result = await extract(`
      const { t } = require('gt-react/unstable');
      const lazy = import('gt-react/unstable');
      const legacy = require('gt-react');
      t\`Hello\`;
    `);

    const unsupported = result.warnings.filter((w) =>
      w.includes('gt-react/unstable')
    );
    expect(unsupported.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '2',
      '3',
    ]);
    expect(treeUpdates(result)).toEqual([]);
  });

  it('warns about a hook used without calling it', async () => {
    const result = await extract(`
      import { useGT } from 'gt-react/unstable';
      const useTranslate = useGT;
      type Hook = typeof useGT;
      function Component() {
        const gt = useTranslate();
        return gt\`Hello\`;
      }
    `);

    const unfollowed = result.warnings.filter((w) =>
      w.includes('Could not follow this use')
    );
    expect(unfollowed.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual(['3']);
  });

  it('warns about namespace imports and re-exports of unstable sources', async () => {
    const result = await extract(`
      import * as GT from 'gt-react/unstable';
      export { t } from 'gt-react/unstable';
      export * from 'gt-react/unstable';
      import * as legacy from 'gt-react';
      GT.t\`Hello\`;
    `);

    const unsupported = result.warnings.filter((w) =>
      w.includes('gt-react/unstable')
    );
    expect(unsupported.map((w) => w.match(/\((\d+):\d+\)/)?.[1])).toEqual([
      '2',
      '3',
      '4',
    ]);
  });

  describe('__proto__ keys', () => {
    const select = (branches: Record<string, string>) =>
      buildMessageTree(['', ''], [{ kind: 'select', name: 'role', branches }])
        .tree;

    it.each(["__proto__: 'Proto'", "'__proto__': 'Proto'"])(
      'ignores a %s branch with a warning, like the runtime',
      async (branch) => {
        const result = await extract(`
          import { t, select } from 'gt-react/unstable';
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
        import { t, select } from 'gt-react/unstable';
        t\`\${select({ role }, { ['__proto__']: 'Proto', other: 'Guest' })}\`;
      `);

      expect(result.warnings).toEqual([]);
      const branches = Object.fromEntries([
        ['__proto__', 'Proto'],
        ['other', 'Guest'],
      ]);
      const [update] = treeUpdates(result);
      expect(Object.keys(update.source[0][2])).toEqual(['__proto__', 'other']);
      expect(update.metadata.hash).toBe(hashMessageTree(select(branches)));
      expect(update.metadata.hash).not.toBe(
        hashMessageTree(select({ other: 'Guest' }))
      );
    });
  });
});
