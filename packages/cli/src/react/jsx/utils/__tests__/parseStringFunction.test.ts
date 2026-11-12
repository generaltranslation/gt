import nodePath from 'node:path';
import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { parseStrings, clearParsingCaches } from '../parseStringFunction.js';
import { resolveImportPath } from '../resolveImportPath.js';
import { Updates } from 'generaltranslation';

vi.mock('node:fs');
vi.mock('../resolveImportPath.js');

const traverse = traverseModule.default || traverseModule;

type Config = Parameters<typeof parseStrings>[3];

const FILE_PATH = 'test.tsx';

/**
 * Runs parseStrings for the import of `functionName` in `code`, the way
 * createInlineUpdates does for every GT import it finds.
 */
function run(code: string, functionName: string, config: Partial<Config> = {}) {
  const output = {
    updates: [] as Updates,
    errors: [] as string[],
    warnings: new Set<string>(),
  };
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  traverse(ast, {
    ImportSpecifier(path) {
      if (
        t.isIdentifier(path.node.imported) &&
        path.node.imported.name === functionName
      ) {
        parseStrings(
          path.node.local.name,
          functionName,
          path,
          {
            parsingOptions: { conditionNames: [] },
            file: FILE_PATH,
            ignoreInlineMetadata: false,
            ignoreDynamicContent: false,
            ignoreInvalidIcu: false,
            ignoreInlineListContent: true,
            ignoreTaggedTemplates: false,
            ignoreGlobalTaggedTemplates: false,
            autoderiveMethod: 'DISABLED',
            ...config,
          },
          output
        );
      }
    },
  });
  return output;
}

/** Every update as [source, metadata], without the bookkeeping fields. */
function extracted({ updates }: { updates: Updates }) {
  return updates.map(({ dataFormat, source, metadata }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { filePaths, staticId, ...rest } = metadata;
    expect(dataFormat).toBe('ICU');
    return [source, rest];
  });
}

const NON_STRING = (code: string) => `Found non-string literal (${code})`;

beforeEach(() => {
  vi.resetAllMocks();
  clearParsingCaches();
});

describe('parseStrings', () => {
  // msg() cases run with inline lists enabled, like the array cases below
  const lists = { ignoreInlineListContent: false };

  it.each<[string, string, string, unknown[], Partial<Config>?]>([
    // Hooks and their metadata
    [
      'a useGT() call with $id',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const t = useGT();
       t('hello world', { $id: 'greeting' });`,
      [['hello world', { id: 'greeting' }]],
    ],
    [
      'an awaited getGT() call with $context',
      'getGT',
      `import { getGT } from 'generaltranslation';
       async function test() {
         const t = await getGT();
         t('hello world', { $context: 'page' });
       }`,
      [['hello world', { context: 'page' }]],
    ],
    [
      'a template literal without expressions',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const t = useGT();
       t(\`hello world\`);`,
      [['hello world', {}]],
    ],
    [
      '$id, $context and $maxChars together',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const gt = useGT();
       gt("hello world", { $id: 'greeting', $context: 'homepage', $maxChars: 25 });`,
      [['hello world', { id: 'greeting', context: 'homepage', maxChars: 25 }]],
    ],
    [
      '$maxChars next to an ICU variable',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const gt = useGT();
       gt("hello, {name}", { name: "John", $maxChars: 10 });`,
      [['hello, {name}', { maxChars: 10 }]],
    ],
    [
      '$maxChars of zero',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const gt = useGT();
       gt("hello world", { $maxChars: 0 });`,
      [['hello world', { maxChars: 0 }]],
    ],
    [
      'a negative $maxChars as its absolute value',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const gt = useGT();
       gt("hello world", { $maxChars: -5 });`,
      [['hello world', { maxChars: 5 }]],
    ],
    [
      '$requiresReview: true',
      'useGT',
      `import { useGT } from 'gt-react';
       const gt = useGT();
       gt('hello world', { $requiresReview: true });`,
      [['hello world', { requiresReview: true }]],
    ],
    [
      '$requiresReview: false',
      'useGT',
      `import { useGT } from 'gt-react';
       const gt = useGT();
       gt('hello world', { $requiresReview: false });`,
      [['hello world', { requiresReview: false }]],
    ],
    [
      'no metadata from options without the $ prefix',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const t = useGT();
       t('hello world', { id: 'static-id', context: 'static-context' });`,
      [['hello world', {}]],
    ],

    // Aliases of the translation function
    [
      'a call through a chain of aliases',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function test() {
         const translate = useGT();
         const t = translate;
         const a = t;
         const b = a;
         const c = b;
         c('hello world', { $id: 'deep-alias' });
       }`,
      [['hello world', { id: 'deep-alias' }]],
    ],
    [
      'calls through the original and its aliases',
      'getGT',
      `import { getGT } from 'generaltranslation';
       async function test() {
         const translate = await getGT();
         const t = translate;
         const alias = t;
         translate('original call', { $id: 'original' });
         t('alias call', { $context: 'page' });
         t(\`template literal\`);
         alias('deep alias call', { $id: 'deep' });
       }`,
      [
        ['original call', { id: 'original' }],
        ['alias call', { context: 'page' }],
        ['template literal', {}],
        ['deep alias call', { id: 'deep' }],
      ],
    ],
    [
      // TODO: the alias in the inner function is not followed yet
      'only the outer call when an alias is created in a nested function',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function outer() {
         const translate = useGT();
         function inner() {
           const t = translate;
           t('inner scope', { $id: 'inner' });
         }
         translate('outer scope', { $id: 'outer' });
         inner();
       }`,
      [['outer scope', { id: 'outer' }]],
    ],
    [
      'only the direct call when an alias is assigned conditionally',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function test(condition) {
         const translate = useGT();
         const t = condition ? translate : null;
         if (t) {
           t('conditional message', { $id: 'conditional' });
         }
         translate('direct usage', { $id: 'direct' });
       }`,
      [['direct usage', { id: 'direct' }]],
    ],
    [
      'an alias declared after an unrelated destructuring',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function test() {
         const translate = useGT();
         const { length } = 'test';
         const t = translate;
         t('destructured test', { $id: 'destructured' });
       }`,
      [['destructured test', { id: 'destructured' }]],
    ],
    [
      'aliases that are reassigned to each other',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function test() {
         const translate = useGT();
         let t = translate;
         let a = t;
         t = a;
         t('circular test', { $id: 'circular' });
       }`,
      [['circular test', { id: 'circular' }]],
    ],

    // The translation function passed to other functions
    [
      'a callback passed to a function declaration',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function getGreeting(t) {
         return t('hello world', { $id: 'greeting' });
       }
       const t = useGT();
       getGreeting(t);`,
      [['hello world', { id: 'greeting' }]],
    ],
    [
      'a callback passed to an arrow function',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const getGreeting = (t) => {
         return t('hello world', { $context: 'page' });
       };
       const t = useGT();
       getGreeting(t);`,
      [['hello world', { context: 'page' }]],
    ],
    [
      'a helper once per call that passes the callback or an alias',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function helper(translator) {
         return translator('helper message', { $id: 'helper' });
       }
       function test() {
         const translate = useGT();
         const t = translate;
         helper(translate);
         helper(t);
       }`,
      [
        ['helper message', { id: 'helper' }],
        ['helper message', { id: 'helper' }],
      ],
    ],
    [
      'a function that passes the callback to itself',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function renderTree(gt, nodes) {
         gt('leaf node', { $id: 'leaf' });
         gt('branch node', { $id: 'branch' });
         for (const child of nodes) {
           renderTree(gt, child.children);
         }
       }
       const gt = useGT();
       renderTree(gt, tree);`,
      [
        ['leaf node', { id: 'leaf' }],
        ['branch node', { id: 'branch' }],
      ],
    ],
    [
      'functions that pass the callback to each other',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function processEven(gt, n) {
         gt('even case', { $id: 'even' });
         if (n > 0) processOdd(gt, n - 1);
       }
       function processOdd(gt, n) {
         gt('odd case', { $id: 'odd' });
         if (n > 0) processEven(gt, n - 1);
       }
       const gt = useGT();
       processEven(gt, 10);`,
      [
        ['even case', { id: 'even' }],
        ['odd case', { id: 'odd' }],
      ],
    ],
    [
      'an arrow function that passes the callback to itself in a closure',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const traverse = (gt, node) => {
         gt('visiting node', { $id: 'visit' });
         node.children.forEach(child => traverse(gt, child));
       };
       const gt = useGT();
       traverse(gt, root);`,
      [['visiting node', { id: 'visit' }]],
    ],
    [
      'a recursive function that also calls a helper',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function formatLabel(gt) {
         return gt('label text', { $id: 'label' });
       }
       function walkTree(gt, node) {
         gt('tree node', { $id: 'node' });
         formatLabel(gt);
         if (node.left) walkTree(gt, node.left);
         if (node.right) walkTree(gt, node.right);
       }
       const gt = useGT();
       walkTree(gt, binaryTree);`,
      [
        ['tree node', { id: 'node' }],
        ['label text', { id: 'label' }],
      ],
    ],

    // msg()
    [
      'a msg() call',
      'msg',
      `import { msg } from 'gt-next';
       msg('hello world');`,
      [['hello world', {}]],
    ],
    [
      'a msg() template literal without expressions',
      'msg',
      `import { msg } from 'generaltranslation';
       msg(\`hello world\`);`,
      [['hello world', {}]],
      lists,
    ],
    [
      'an aliased msg import',
      'msg',
      `import { msg as message } from 'generaltranslation';
       message('aliased msg call');`,
      [['aliased msg call', {}]],
      lists,
    ],
    [
      'msg() but not msg.decode()',
      'msg',
      `import { msg } from 'generaltranslation';
       msg.decode('should not work');
       msg('should work');`,
      [['should work', {}]],
      lists,
    ],
    [
      'msg() calls in functions, conditions and methods',
      'msg',
      `import { msg } from 'generaltranslation';
       function test() {
         const result = msg('function context');
         return result;
       }
       const arrow = () => msg('arrow function');
       if (true) {
         msg('conditional context');
       }
       const obj = {
         method() {
           msg('object method');
         }
       };`,
      [
        ['function context', {}],
        ['arrow function', {}],
        ['conditional context', {}],
        ['object method', {}],
      ],
      lists,
    ],
    [
      'the msg() inside a useMessages() call',
      'msg',
      `import { msg, useMessages } from 'gt-react';
       const m = useMessages();
       m(msg("some string"));`,
      [['some string', {}]],
      lists,
    ],

    // msg() arrays (processTranslationCall has its own array cases)
    [
      'a msg() array with an indexed $id and shared $context',
      'msg',
      `import { msg } from 'gt-next';
       msg(["a", "b"], { $id: "x", $context: "nav" });`,
      [
        ['a', { id: 'x.0', context: 'nav' }],
        ['b', { id: 'x.1', context: 'nav' }],
      ],
      lists,
    ],

    // useMessages() / getMessages() ignore metadata and accept dynamic
    // arguments, because the argument may be an encoded msg()
    [
      'a useMessages() call without its metadata',
      'useMessages',
      `import { useMessages } from 'generaltranslation';
       const t = useMessages();
       t('hello world', { $id: 'greeting', $context: 'homepage' });`,
      [['hello world', {}]],
    ],
    [
      'an awaited getMessages() call without its metadata',
      'getMessages',
      `import { getMessages } from 'generaltranslation';
       async function test() {
         const t = await getMessages();
         t('hello world', { $context: 'page' });
       }`,
      [['hello world', {}]],
    ],
    [
      'a useMessages() template literal without expressions',
      'useMessages',
      `import { useMessages } from 'generaltranslation';
       const t = useMessages();
       t(\`hello world\`);`,
      [['hello world', {}]],
    ],
    [
      'a useMessages() callback passed to a function',
      'useMessages',
      `import { useMessages } from 'generaltranslation';
       function getGreeting(t) {
         return t('hello world', { $id: 'greeting' });
       }
       const t = useMessages();
       getGreeting(t);`,
      [['hello world', {}]],
    ],
    [
      'a getMessages() callback passed to a function',
      'getMessages',
      `import { getMessages } from 'generaltranslation';
       function getGreeting(t) {
         return t('hello world', { $context: 'page' });
       }
       async function test() {
         const t = await getMessages();
         getGreeting(t);
       }`,
      [['hello world', {}]],
    ],
    [
      'nothing from a msg() passed to useMessages()',
      'useMessages',
      `import { msg, useMessages } from 'gt-react';
       const m = useMessages();
       m(msg("hello world"));`,
      [],
    ],
    [
      'nothing from a useMessages() template literal with expressions',
      'useMessages',
      `import { useMessages } from 'generaltranslation';
       const t = useMessages();
       const name = 'world';
       t(\`hello \${name}\`);`,
      [],
    ],
    [
      'nothing from a useMessages() call with a variable',
      'useMessages',
      `import { useMessages } from 'generaltranslation';
       const t = useMessages();
       const message = 'hello world';
       t(message);`,
      [],
    ],
    [
      'nothing from a getMessages() call with a variable',
      'getMessages',
      `import { getMessages } from 'generaltranslation';
       async function test() {
         const t = await getMessages();
         const message = 'hello world';
         t(message);
       }`,
      [],
    ],
  ])('extracts %s', (_name, functionName, code, expected, config) => {
    const result = run(code, functionName, config);

    expect(result.errors).toEqual([]);
    expect(result.warnings.size).toBe(0);
    expect(extracted(result)).toEqual(expected);
  });

  it('records the file path on every update', () => {
    const { updates } = run(
      `import { msg } from 'gt-next';
       msg('hello world');`,
      'msg'
    );

    expect(updates).toEqual([
      {
        dataFormat: 'ICU',
        source: 'hello world',
        metadata: { filePaths: [FILE_PATH] },
      },
    ]);
  });

  it('attaches the surrounding source code when asked to', () => {
    const lines = [
      'import { useGT } from "gt-next";',
      '',
      'function Page() {',
      '  const gt = useGT();',
      '  const name = "world";',
      '  const greeting = gt("Hello, {name}!");',
      '  return greeting;',
      '}',
    ];
    const code = lines.join('\n');
    vi.mocked(fs.readFileSync).mockReturnValue(code);

    const { updates } = run(code, 'useGT', {
      file: nodePath.resolve('src/page.tsx'),
      includeSourceCodeContext: true,
    });

    expect(updates.map((update) => update.metadata.sourceCode)).toEqual([
      {
        [nodePath.join('src', 'page.tsx')]: [
          {
            before: lines.slice(0, 5).join('\n'),
            target: lines[5],
            after: lines.slice(6).join('\n'),
          },
        ],
      },
    ]);
  });

  // [description, function, code, expected error fragments, updates still extracted]
  it.each<[string, string, string, string[], unknown[], Partial<Config>?]>([
    [
      'a template literal with expressions',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const t = useGT();
       const name = 'world';
       t(\`hello \${name}\`);`,
      [NON_STRING('`hello ${name}`')],
      [],
    ],
    [
      'a variable argument',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const t = useGT();
       const message = 'hello world';
       t(message);`,
      [NON_STRING('message')],
      [],
    ],
    [
      'dynamic arguments passed to an alias',
      'useGT',
      `import { useGT } from 'generaltranslation';
       function test() {
         const translate = useGT();
         const t = translate;
         const name = 'dynamic';
         t(\`hello \${name}\`);
         t(name);
       }`,
      [NON_STRING('`hello ${name}`'), NON_STRING('name')],
      [],
    ],
    [
      'useGT() in an async function',
      'useGT',
      `import { useGT } from 'generaltranslation';
       async function test() {
         const t = useGT();
         t('hello world');
       }`,
      ['Found useGT() in an async function. Use getGT() instead'],
      [],
    ],
    [
      'getGT() in a synchronous function',
      'getGT',
      `import { getGT } from 'generaltranslation';
       function test() {
         const t = getGT();
         t('hello world');
       }`,
      ['Found getGT() in a synchronous function. Use useGT() instead'],
      [],
    ],
    [
      'useMessages() in an async function',
      'useMessages',
      `import { useMessages } from 'generaltranslation';
       async function test() {
         const t = useMessages();
         t('hello world');
       }`,
      ['in an async function'],
      [],
    ],
    [
      'getMessages() in a synchronous function',
      'getMessages',
      `import { getMessages } from 'generaltranslation';
       function test() {
         const t = getMessages();
         t('hello world');
       }`,
      ['in a synchronous function'],
      [],
    ],
    [
      'a string $maxChars',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const gt = useGT();
       gt("hello world", { $maxChars: "invalid" });`,
      ['Found invalid maxChars value: $maxChars: "invalid"'],
      [['hello world', {}]],
    ],
    [
      'a boolean $maxChars',
      'useGT',
      `import { useGT } from 'generaltranslation';
       const gt = useGT();
       gt("hello world", { $maxChars: true });`,
      ['Found invalid maxChars value: $maxChars: true'],
      [['hello world', {}]],
    ],
    [
      'a string $requiresReview',
      'useGT',
      `import { useGT } from 'gt-react';
       const gt = useGT();
       gt('hello world', { $requiresReview: 'true' });`,
      ["Found invalid requiresReview value: $requiresReview: 'true'"],
      [['hello world', {}]],
    ],
    [
      'a dynamic $requiresReview',
      'useGT',
      `import { useGT } from 'gt-react';
       const flag = Math.random() > 0.5;
       const gt = useGT();
       gt('hello world', { $requiresReview: flag });`,
      ['Found non-static expression for attribute $requiresReview: flag'],
      [['hello world', {}]],
    ],
    [
      'a msg() template literal with expressions',
      'msg',
      `import { msg } from 'generaltranslation';
       const name = 'world';
       msg(\`hello \${name}\`);`,
      [NON_STRING('`hello ${name}`')],
      [],
      lists,
    ],
    [
      'a msg() call with a variable',
      'msg',
      `import { msg } from 'generaltranslation';
       const message = 'hello world';
       msg(message);`,
      [NON_STRING('message')],
      [],
      lists,
    ],
    [
      'a variable inside a msg() array',
      'msg',
      `import { msg } from 'gt-next';
       const someVar = "dynamic";
       msg(["hello", someVar]);`,
      [NON_STRING('someVar')],
      [['hello', {}]],
      lists,
    ],
  ])('reports %s', (_name, functionName, code, errors, expected, config) => {
    const result = run(code, functionName, config);

    expect(result.errors).toEqual(
      errors.map((error) => expect.stringContaining(error))
    );
    expect(extracted(result)).toEqual(expected);
  });

  it.each([
    [
      't() with a template literal',
      't',
      `import { t } from 'gt-react';
       const name = "John";
       t(\`Hello, \${name}\`);`,
    ],
    [
      't() with a concatenation',
      't',
      `import { t } from 'gt-react';
       const name = "John";
       t("Hello, " + name);`,
    ],
    [
      'msg() with a template literal',
      'msg',
      `import { msg } from 'gt-react';
       const name = "John";
       msg(\`Hello, \${name}\`);`,
    ],
    [
      'msg() with a concatenation',
      'msg',
      `import { msg } from 'gt-react';
       const name = "John";
       msg("Hello, " + name);`,
    ],
    [
      'useGT() with a template literal',
      'useGT',
      `import { useGT } from 'gt-react';
       const name = "John";
       const gt = useGT();
       gt(\`Hello, \${name}\`);`,
    ],
    [
      'useGT() with a concatenation',
      'useGT',
      `import { useGT } from 'gt-react';
       const name = "John";
       const gt = useGT();
       gt("Hello, " + name);`,
    ],
    [
      'getGT() with a template literal',
      'getGT',
      `import { getGT } from 'gt-react';
       const name = "John";
       async function test() {
         const gt = await getGT();
         gt(\`Hello, \${name}\`);
       }`,
    ],
  ])('autoderives %s', (_name, functionName, code) => {
    const result = run(code, functionName, { autoderiveMethod: 'AUTO' });

    expect(result.errors).toEqual([]);
    expect(extracted(result)).toEqual([['Hello, John', {}]]);
  });
});

describe('parseStrings across files', () => {
  /**
   * Serves `files` (absolute path -> code). Imports resolve through `aliases`
   * or relative to the importing file, so a wrong importing file resolves to
   * nothing.
   */
  function mockProject(
    files: Record<string, string>,
    aliases: Record<string, string> = {}
  ) {
    vi.mocked(fs.readFileSync).mockImplementation((file) => {
      const code = files[String(file)];
      if (code === undefined) throw new Error(`File not found: ${file}`);
      return code;
    });
    vi.mocked(resolveImportPath).mockImplementation(
      (currentFile, importPath) => {
        const resolved =
          aliases[importPath] ??
          `${nodePath.posix.resolve(nodePath.posix.dirname(currentFile), importPath)}.ts`;
        return resolved in files ? resolved : null;
      }
    );
  }

  /** A component that passes gt to `fn`, imported from `from`. */
  const component = (fn: string, from: string) => `
    import { useGT } from 'gt-react';
    import { ${fn} } from '${from}';
    function Component() {
      const gt = useGT();
      ${fn}(gt);
    }
  `;
  const extract = (code: string) =>
    run(code, 'useGT', { file: '/app/page.tsx' });

  it.each<[string, string, Record<string, string>, unknown[]]>([
    [
      // './helpers' only resolves relative to utils.ts, not to the page
      'a chain of three files',
      component('getDetails', '@lib/utils'),
      {
        '/lib/src/utils.ts': `
          import { getLabel } from './helpers';
          export function getDetails(gt) {
            gt('detail string', { $id: 'detail' });
            getLabel(gt);
          }`,
        '/lib/src/helpers.ts': `
          export function getLabel(gt) {
            gt('label string', { $id: 'label' });
          }`,
      },
      [
        ['detail string', { id: 'detail' }],
        ['label string', { id: 'label' }],
      ],
    ],
    [
      'a re-export',
      component('process', '@lib/utils'),
      {
        '/lib/src/utils.ts': `export { process } from './processor';`,
        '/lib/src/processor.ts': `
          export function process(gt) {
            gt('processed', { $id: 'processed' });
          }`,
      },
      [['processed', { id: 'processed' }]],
    ],
    [
      'parameters with a default value',
      component('getCopy', '@lib/utils'),
      {
        '/lib/src/utils.ts': `
          import { formatCopy } from './format';
          export function getCopy(gt = fallback) {
            gt('direct copy', { $id: 'direct' });
            formatCopy(gt);
          }`,
        '/lib/src/format.ts': `
          export function formatCopy(gt = fallback) {
            gt('formatted copy', { $id: 'formatted' });
          }`,
      },
      [
        ['direct copy', { id: 'direct' }],
        ['formatted copy', { id: 'formatted' }],
      ],
    ],
  ])('follows gt through %s', (_name, code, files, expected) => {
    mockProject(files, { '@lib/utils': '/lib/src/utils.ts' });

    const result = extract(code);

    expect(result.errors).toEqual([]);
    expect(result.warnings.size).toBe(0);
    expect(extracted(result)).toEqual(expected);
  });

  // Regression guard: config.file must be updated at each file boundary
  it('resolves nested imports relative to the file that contains them', () => {
    mockProject(
      {
        '/pkg/src/outer.ts': `
          import { inner } from './inner';
          export function outer(gt) {
            inner(gt);
          }`,
        '/pkg/src/inner.ts': `
          export function inner(gt) {
            gt('inner string', { $id: 'inner' });
          }`,
      },
      { '@pkg/outer': '/pkg/src/outer.ts' }
    );

    const result = extract(component('outer', '@pkg/outer'));

    expect(extracted(result)).toEqual([['inner string', { id: 'inner' }]]);
    expect(
      vi
        .mocked(resolveImportPath)
        .mock.calls.filter(([, importPath]) => importPath === './inner')
        .map(([currentFile]) => currentFile)
    ).toEqual(['/pkg/src/outer.ts']);
  });

  it('warns when the imported function cannot be resolved', () => {
    mockProject({});

    const result = extract(component('getData', '@app/data'));

    expect(result.errors).toEqual([]);
    expect(result.updates).toEqual([]);
    expect([...result.warnings]).toEqual([
      expect.stringContaining(
        'Could not resolve import @app/data for function getData'
      ),
    ]);
  });

  it('warns about an unresolved nested import and keeps the strings found', () => {
    mockProject(
      {
        '/pkg/src/outer.ts': `
          import { inner } from './missing-file';
          export function outer(gt) {
            gt('found', { $id: 'found' });
            inner(gt);
          }`,
      },
      { '@pkg/outer': '/pkg/src/outer.ts' }
    );

    const result = extract(component('outer', '@pkg/outer'));

    expect(result.errors).toEqual([]);
    expect(extracted(result)).toEqual([['found', { id: 'found' }]]);
    expect([...result.warnings]).toEqual([
      expect.stringContaining(
        '/pkg/src/outer.ts (5:18): Could not resolve import ./missing-file for function inner'
      ),
    ]);
  });
});
