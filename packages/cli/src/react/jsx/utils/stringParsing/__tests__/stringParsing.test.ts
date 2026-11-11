import fs from 'node:fs';
import nodePath from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { processTranslationCall } from '../processTranslationCall/index.js';
import { processTaggedTemplateCall } from '../processTaggedTemplateCall/index.js';
import { handleDerivation } from '../derivation/handleDerivation.js';
import { nodeToStrings } from '../../parseString.js';
import { ParsingConfig, ParsingOutput } from '../types.js';

const traverse = traverseModule.default || traverseModule;

const FILE_PATH = 'test.tsx';

const parseCode = (code: string) =>
  parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

/**
 * Runs `process` on every `t(...)` call or t`...` template in `code`, passing
 * the path of the `t` identifier like parseStrings does.
 */
function run(
  process: typeof processTranslationCall,
  code: string,
  config: Partial<ParsingConfig> = {}
) {
  const output: ParsingOutput = {
    updates: [],
    errors: [],
    warnings: new Set<string>(),
  };
  traverse(parseCode(code), {
    Identifier(path) {
      if (path.node.name !== 't' || path.key === 'property') return;
      process(
        path,
        {
          parsingOptions: { conditionNames: [] },
          file: FILE_PATH,
          ignoreInlineMetadata: false,
          ignoreDynamicContent: false,
          ignoreInvalidIcu: false,
          ignoreInlineListContent: false,
          ignoreTaggedTemplates: false,
          ignoreGlobalTaggedTemplates: false,
          autoderiveMethod: 'DISABLED',
          ...config,
        },
        output
      );
    },
  });
  return output;
}

/** Every update as [dataFormat, source, metadata], without bookkeeping fields. */
function extracted({ updates }: ParsingOutput) {
  return updates.map(({ dataFormat, source, metadata }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { filePaths, staticId, ...rest } = metadata;
    return [dataFormat, source, rest];
  });
}

const NON_STRING = (code: string) => `Found non-string literal (${code})`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('processTranslationCall', () => {
  const call = (code: string) => run(processTranslationCall, code);

  it.each<[string, unknown[]]>([
    // Arrays register one string per element
    [
      't(["hello", "world"])',
      [
        ['ICU', 'hello', {}],
        ['ICU', 'world', {}],
      ],
    ],
    [
      't([`hello`, `world`])',
      [
        ['ICU', 'hello', {}],
        ['ICU', 'world', {}],
      ],
    ],
    [
      't(["a", "b"], { $id: "x", $context: "page" })',
      [
        ['ICU', 'a', { id: 'x.0', context: 'page' }],
        ['ICU', 'b', { id: 'x.1', context: 'page' }],
      ],
    ],
    [
      't(["a", "b"], { $context: "nav" })',
      [
        ['ICU', 'a', { context: 'nav' }],
        ['ICU', 'b', { context: 'nav' }],
      ],
    ],
    [
      't(["a", "b"], { $maxChars: 10 })',
      [
        ['ICU', 'a', { maxChars: 10 }],
        ['ICU', 'b', { maxChars: 10 }],
      ],
    ],
    [
      't(["Hello", "World"], { $format: "STRING" })',
      [
        ['STRING', 'Hello', { format: 'STRING' }],
        ['STRING', 'World', { format: 'STRING' }],
      ],
    ],
    ['t(["only"], { $id: "single" })', [['ICU', 'only', { id: 'single.0' }]]],
    ['t([])', []],

    // $format selects the data format
    ['t("Hello")', [['ICU', 'Hello', {}]]],
    [
      't("Hello", { $format: "STRING" })',
      [['STRING', 'Hello', { format: 'STRING' }]],
    ],
    [
      't("Hello", { $id: "greeting", $context: "home", $format: "I18NEXT" })',
      [
        [
          'I18NEXT',
          'Hello',
          { id: 'greeting', context: 'home', format: 'I18NEXT' },
        ],
      ],
    ],
    // Invalid ICU is fine in a STRING, and template literals are cooked
    [
      't("Hello {{plain}} string", { $format: "STRING" })',
      [['STRING', 'Hello {{plain}} string', { format: 'STRING' }]],
    ],
    [
      't(`Line one.\\n\\nLine two\\tTabbed`, { $format: "STRING" })',
      [['STRING', 'Line one.\n\nLine two\tTabbed', { format: 'STRING' }]],
    ],
    [
      't("Hello", { $context: "greeting" })',
      [['ICU', 'Hello', { context: 'greeting' }]],
    ],
  ])('%s', (code, expected) => {
    const output = call(code);

    expect(output.errors).toEqual([]);
    expect(output.warnings.size).toBe(0);
    expect(extracted(output)).toEqual(expected);
  });

  it.each([
    [
      'a template literal with expressions',
      'const name = "world";\nt(["hello", `hi ${name}`]);',
      NON_STRING('`hi ${name}`'),
    ],
    [
      'a variable',
      'const someVar = "dynamic";\nt(["hello", someVar]);',
      NON_STRING('someVar'),
    ],
  ])(
    'reports %s inside an array and keeps the other elements',
    (_name, code, error) => {
      const output = call(code);

      expect(output.errors).toEqual([expect.stringContaining(error)]);
      expect(extracted(output)).toEqual([['ICU', 'hello', {}]]);
    }
  );

  it('warns about an unknown $format and falls back to ICU', () => {
    const output = call('t("Hello", { $format: "INVALID" })');

    expect(extracted(output)).toEqual([['ICU', 'Hello', {}]]);
    expect(output.warnings.size).toBe(1);
  });

  it.each([
    't("Hello {{plain}} string", { $format: "ICU" })',
    't("Hello {{plain}} string")',
  ])('warns about invalid ICU and skips the string: %s', (code) => {
    const output = call(code);

    expect(output.updates).toEqual([]);
    expect(output.warnings.size).toBe(1);
  });

  describe('derive in $context', () => {
    it.each([
      [
        'a ternary',
        'derive(x ? "formal" : "casual")',
        '',
        ['formal', 'casual'],
      ],
      [
        'a function call',
        'derive(getFormality())',
        'function getFormality() { if (isFormal) { return "formal"; } else { return "casual"; } }',
        ['formal', 'casual'],
      ],
      [
        'a concatenation',
        '"prefix-" + derive(x ? "formal" : "casual")',
        '',
        ['prefix-formal', 'prefix-casual'],
      ],
      [
        'a template literal',
        '`prefix-${derive(x ? "formal" : "casual")}`',
        '',
        ['prefix-formal', 'prefix-casual'],
      ],
    ])(
      'produces one update per variant of %s',
      (_name, context, setup, contexts) => {
        const output = call(`
        import { derive } from 'gt-react';
        ${setup}
        t("Hello", { $context: ${context} })
      `);

        expect(output.errors).toEqual([]);
        expect(extracted(output)).toEqual(
          contexts.map((variant) => ['ICU', 'Hello', { context: variant }])
        );
        // The variants are tied together by a shared staticId
        expect(output.updates[0].metadata.staticId).toEqual(expect.any(String));
        expect(output.updates[1].metadata.staticId).toBe(
          output.updates[0].metadata.staticId
        );
      }
    );

    it('multiplies derived content by derived context', () => {
      const output = call(`
        import { derive } from 'gt-react';
        t(derive(x ? "Hello" : "Hi"), { $context: derive(y ? "formal" : "casual") })
      `);

      expect(output.errors).toEqual([]);
      expect(extracted(output)).toEqual([
        ['ICU', 'Hello', { context: 'formal' }],
        ['ICU', 'Hello', { context: 'casual' }],
        ['ICU', 'Hi', { context: 'formal' }],
        ['ICU', 'Hi', { context: 'casual' }],
      ]);
      expect(output.updates[0].metadata.staticId).toEqual(expect.any(String));
      expect(new Set(output.updates.map((u) => u.metadata.staticId)).size).toBe(
        1
      );
    });
  });
});

describe('processTaggedTemplateCall', () => {
  const tag = (code: string, config?: Partial<ParsingConfig>) =>
    run(processTaggedTemplateCall, code, config);
  const deriveLines = [
    "import { derive } from 'gt-react';",
    '',
    'function getSubject() {',
    '  if (gender === "male") {',
    '    return "boy";',
    '  } else {',
    '    return "girl";',
    '  }',
    '}',
    '',
    'const sentence = t`The ${derive(getSubject())} is playing in the park.`;',
  ];
  const deriveSources = [
    'The boy is playing in the park.',
    'The girl is playing in the park.',
  ];

  // The placeholders for runtime interpolation are covered by handleDerivation
  it.each([
    ['t`hello`', 'hello'],
    ['t`Hello, ${name}`', 'Hello, {0}'],
    ['t``', ''],
  ])('%s registers %j', (code, source) => {
    const output = tag(code);

    expect(output.errors).toEqual([]);
    expect(extracted(output)).toEqual([['ICU', source, {}]]);
  });

  it('registers every derive variant with the file path and a staticId', () => {
    const output = tag(deriveLines.join('\n'));

    expect(output.updates.map((u) => u.source)).toEqual(deriveSources);
    for (const { metadata } of output.updates) {
      expect(metadata.filePaths).toEqual([FILE_PATH]);
      expect(metadata.staticId).toEqual(expect.any(String));
    }
  });

  it('attaches the surrounding source code to every derive variant', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(deriveLines.join('\n'));
    const relativePath = nodePath.join('src', 'page.tsx');

    const output = tag(deriveLines.join('\n'), {
      file: nodePath.resolve(relativePath),
      includeSourceCodeContext: true,
    });

    expect(output.updates.map((u) => u.source)).toEqual(deriveSources);
    for (const { metadata } of output.updates) {
      expect(metadata.filePaths).toEqual([relativePath]);
      expect(metadata.sourceCode).toEqual({
        [relativePath]: [
          {
            before: deriveLines.slice(5, 10).join('\n'),
            target: deriveLines[10],
            after: '',
          },
        ],
      });
    }
  });

  // The flag is checked by the caller, not here
  it('ignores ignoreTaggedTemplates', () => {
    const output = tag('t`hello ${name}`', { ignoreTaggedTemplates: true });

    expect(extracted(output)).toEqual([['ICU', 'hello {0}', {}]]);
  });
});

describe('handleDerivation', () => {
  /**
   * Runs handleDerivation on the first expression statement of `code`. For a
   * t`...` statement the template is derived, like the real entry point does.
   */
  function derive(
    code: string,
    {
      runtimeInterpolation = false,
      skipDeriveInvocation = false,
    }: { runtimeInterpolation?: boolean; skipDeriveInvocation?: boolean } = {}
  ) {
    let result: ReturnType<typeof handleDerivation> = null;
    const errors: string[] = [];
    traverse(parseCode(code), {
      ExpressionStatement(path: NodePath<t.ExpressionStatement>) {
        const statement = path.node.expression;
        const isTemplate = t.isTaggedTemplateExpression(statement);
        result = handleDerivation({
          expr: isTemplate ? statement.quasi : statement,
          tPath: isTemplate ? path.get('expression') : path,
          file: FILE_PATH,
          parsingOptions: { conditionNames: [] },
          errors,
          warnings: new Set(),
          runtimeInterpolationState: runtimeInterpolation
            ? { index: 0 }
            : undefined,
          skipDeriveInvocation,
        });
        path.stop();
      },
    });
    return { result, errors };
  }

  const text = (value: string) => ({ type: 'text', text: value });
  const sequence = (...nodes: unknown[]) => ({ type: 'sequence', nodes });
  const choice = (...nodes: unknown[]) => ({ type: 'choice', nodes });

  // [expression, options, result, number of errors]
  it.each<[string, Parameters<typeof derive>[1], unknown, number]>([
    // Static expressions (parenthesized so the string is not a directive)
    ['("hello")', {}, text('hello'), 0],
    ['42', {}, text('42'), 0],
    ['true', {}, text('true'), 0],
    ['null', {}, text('null'), 0],
    ['"A" + "B"', {}, sequence(text('A'), text('B')), 0],

    // Dynamic expressions cannot be derived
    ['name', {}, null, 0],
    ['"A" + name', {}, null, 0],
    ['foo()', {}, null, 1],

    // ... unless runtime interpolation turns them into placeholders
    ['name', { runtimeInterpolation: true }, text('{0}'), 0],
    ['foo()', { runtimeInterpolation: true }, text('{0}'), 0],
    ['user.name', { runtimeInterpolation: true }, text('{0}'), 0],
    [
      '"A" + name',
      { runtimeInterpolation: true },
      sequence(text('A'), text('{0}')),
      0,
    ],
    [
      'a + b',
      { runtimeInterpolation: true },
      sequence(text('{0}'), text('{1}')),
      0,
    ],

    // Autoderive resolves identifiers through their const binding
    [
      'const greeting = "hello";\ngreeting',
      { skipDeriveInvocation: true },
      choice(text('hello')),
      0,
    ],
    [
      'const name = "world";\n`Hello ${name}`',
      { skipDeriveInvocation: true },
      sequence(text('Hello '), choice(text('world'))),
      0,
    ],
    ['("hello")', { skipDeriveInvocation: true }, text('hello'), 0],
    [
      '"A" + "B"',
      { skipDeriveInvocation: true },
      sequence(text('A'), text('B')),
      0,
    ],
    ['unknown', { skipDeriveInvocation: true }, null, 1],
    ['foo()', { skipDeriveInvocation: true }, null, 1],
  ])('%s with %j', (code, options, expected, errorCount) => {
    const { result, errors } = derive(code, options);

    expect(result).toEqual(expected);
    expect(errors).toHaveLength(errorCount);
  });

  it('names the function in the error for a call that is not derive()', () => {
    expect(derive('foo()').errors).toEqual([expect.stringContaining('foo')]);
  });

  it.each([
    ['t`Hello, ${name}`', ['Hello, {0}']],
    ['t`${greeting}, ${name}!`', ['{0}, {1}!']],
    ['t`${a}${b}${c}`', ['{0}{1}{2}']],
    ['t`result: ${foo()}`', ['result: {0}']],
    ['t`Hello, ${user.name}`', ['Hello, {0}']],
    ['t`A${"B" + name}C`', ['AB{0}C']],
    ['t`X${name + "Y"}Z`', ['X{0}YZ']],
  ])('%s with runtime interpolation derives %j', (code, strings) => {
    const { result, errors } = derive(code, { runtimeInterpolation: true });

    expect(errors).toEqual([]);
    expect(nodeToStrings(result)).toEqual(strings);
  });

  it('derives a template without runtime interpolation only when it is static', () => {
    expect(derive('t`Hello, ${name}`').result).toBeNull();
    expect(nodeToStrings(derive('t`Hello, ${"world"}`').result)).toEqual([
      'Hello, world',
    ]);
  });
});
