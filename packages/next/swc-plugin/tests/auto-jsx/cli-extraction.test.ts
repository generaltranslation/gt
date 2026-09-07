import { describe, expect, it } from 'vitest';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { hashSource } from 'generaltranslation/id';
import { oracle } from './oracle';
import { cliOracle } from './cli-oracle';
import { initializeState } from '../../../../compiler/src/state/utils/initializeState';
import { collectionPass } from '../../../../compiler/src/passes/collectionPass';
import { getPathsAndAliases } from '../../../../cli/src/react/jsx/utils/getPathsAndAliases';
import { parseTranslationComponent } from '../../../../cli/src/react/jsx/utils/jsxParsing/parseJsx';
import {
  GT_LIBRARIES_UPSTREAM,
  Libraries,
} from '../../../../cli/src/types/libraries';
import type { Updates } from '../../../../cli/src/types';

function extractCli(input: string) {
  const ast = cliOracle(input);
  const original = generate(ast, { comments: true }).code;
  const pkgs = GT_LIBRARIES_UPSTREAM[Libraries.GT_NEXT];
  const { importAliases, translationComponentPaths } = getPathsAndAliases(
    ast,
    pkgs
  );
  for (const { localName, originalName } of translationComponentPaths)
    importAliases[localName] = originalName;
  const updates: Updates = [];
  const errors: string[] = [];
  for (const { localName, originalName, path } of translationComponentPaths) {
    if (originalName !== 'GtInternalTranslateJsx') continue;
    parseTranslationComponent({
      originalName,
      localName,
      path,
      updates,
      config: {
        importAliases,
        parsingOptions: { conditionNames: ['import', 'require'] },
        pkgs,
        file: '/input.tsx',
        includeSourceCodeContext: false,
        enableAutoJsxInjection: true,
      },
      output: { errors, warnings: new Set(), unwrappedExpressions: [] },
    });
  }
  // Extraction cannot rewrite the user's executable insertion AST.
  expect(generate(ast, { comments: true }).code).toBe(original);
  return {
    errors,
    updates,
    hashes: [
      ...new Set(
        updates.map((update) =>
          hashSource({ dataFormat: 'JSX', source: update.source })
        )
      ),
    ].sort(),
  };
}

function extractCompiler(input: string) {
  const ast = oracle(input);
  const state = initializeState(
    {
      enableAutoJsxInjection: true,
      enableMacroTransform: false,
      compileTimeHash: true,
      autoderive: false,
      logLevel: 'silent',
    },
    'input.tsx'
  );
  traverse(ast, collectionPass(state));
  return {
    errors: state.errorTracker.getErrors(),
    entries: state.stringCollector.getAllTranslationJsx(),
    hashes: [
      ...new Set(
        state.stringCollector
          .getAllTranslationJsx()
          .map((entry) => entry.hash)
          .filter(Boolean)
      ),
    ].sort(),
  };
}

const texts = [
  'Hello',
  ' Hello ',
  'Line\nbreak',
  'Line\r\nbreak',
  'Tab\there',
  '  Two  spaces  ',
  'Nonbreaking\u00a0space',
  'Quotes " and \'',
  '<>&',
  '日本語',
  'Emoji 🌏',
  '\n Edge \n',
];
const variants = [
  (text: string) => `<p>{${JSON.stringify(text)}}</p>`,
  (text: string) => `<p>{[${JSON.stringify(text)}]}</p>`,
  (text: string) => `<p>{[${JSON.stringify(text)}, value]}</p>`,
  (text: string) => `<p>{[${JSON.stringify(text)}, [value, other]]}</p>`,
  (text: string) =>
    `<p>{[${JSON.stringify(text)}, <b key="b">Bold {value}</b>]}</p>`,
  (text: string) => `<p children={${JSON.stringify(text)}}/>`,
  (text: string) => `<p children={[${JSON.stringify(text)}, value]}/>`,
  (text: string) => `<p {...{children: [${JSON.stringify(text)}, value]}}/>`,
  (text: string) => `<p>{(${JSON.stringify(text)} as const)}</p>`,
  (text: string) =>
    `<p>{([${JSON.stringify(text)}, value] satisfies unknown[])}</p>`,
  (text: string) =>
    `<main>Prefix <p children={${JSON.stringify(text)}}/> suffix</main>`,
  (text: string) =>
    `<main>Prefix <p>{[${JSON.stringify(text)}, value]}</p> suffix</main>`,
  (text: string) =>
    `<main>Prefix <p>{[${JSON.stringify(text)}]}</p> suffix</main>`,
  (text: string) =>
    `<main>Prefix <>{[${JSON.stringify(text)}, value]}</> suffix</main>`,
  (text: string) =>
    `<main>Prefix <>{[${JSON.stringify(text)}]}</> suffix</main>`,
  (text: string) =>
    `<main>Prefix <p {...{children: [${JSON.stringify(text)}]}}/> suffix</main>`,
  (text: string) =>
    `<main>Prefix <p children={true}>{${JSON.stringify(text)}}</p> suffix</main>`,
];
const examples = texts.flatMap((text, textIndex) =>
  variants.map((variant, variantIndex) => ({
    name: `text-${textIndex}/syntax-${variantIndex}`,
    input: `type Value = string; const value: Value = 'Ada'; const other = 2; export const Page = () => ${variant(text)};`,
  }))
);
for (const helper of ['jsx', 'jsxs', 'jsxDEV']) {
  for (const [index, text] of texts.entries()) {
    for (const children of [
      JSON.stringify(text),
      `[${JSON.stringify(text)}, value]`,
      `[${JSON.stringify(text)}, make('b', {children: ['Bold ', value]}${helper === 'jsxDEV' ? ', undefined, true' : ''})]`,
    ]) {
      examples.push({
        name: `runtime-${helper}/text-${index}/${children}`,
        input: `import {${helper} as make} from 'react/${helper === 'jsxDEV' ? 'jsx-dev-runtime' : 'jsx-runtime'}'; const value = 'Ada'; export const Page = () => make('p', {children: ${children}}${helper === 'jsxDEV' ? ', undefined, true' : ''});`,
      });
    }
  }
}

describe('CLI automatic insertion extraction matches the live compiler', () => {
  it.each(['NaN', 'Infinity', '-Infinity'])(
    'extracts a module enum constant through shadowed globals: %s',
    (value) => {
      const input = `enum E { Value = ${value} } export function Page(NaN: number, Infinity: number) { return <p>Enum {E.Value} after</p>; }`;
      const compiler = extractCompiler(input);
      const cli = extractCli(input);
      expect(compiler.errors).toEqual([]);
      expect(cli.errors).toEqual([]);
      expect(cli.hashes).toEqual(compiler.hashes);
    }
  );

  it.each(
    [
      ["enum E { Value = 'Ready label' }", 'E.Value'],
      ['const enum E { Value = 1 }', 'E.Value'],
      ['enum E { First = 1, Next, Value = Next + 3 }', 'E.Value'],
      ["enum E { Value = 'Ready label' }", "E['Value']"],
      ["enum E { Value = 'Ready label' }", 'E[`Value`]'],
      ["enum E { Value = 'Ready label' }", "E[('Value')]"],
      [
        "enum E { Value = 'Ready label' } (E as any).Value = 'Changed';",
        'E.Value',
      ],
      [
        "enum E { Value = 'Ready label' } enum E { Other = 'Other label' }",
        'E.Other',
      ],
      ['enum Other { A = 2 } enum E { Value = Other.A + 2 }', 'E.Value'],
      ['enum E { Value = Other.A + 2 } enum Other { A = 2 }', 'E.Value'],
      ["enum E { A = 'First', Value = `${A} label` }", 'E.Value'],
      ['enum E { Value = -3 }', 'E.Value'],
      ['enum E { Value = -0 }', 'E.Value'],
      ['enum E { Value = NaN }', 'E.Value'],
      ['enum E { Value = Infinity }', 'E.Value'],
      ['enum E { Value = -Infinity }', 'E.Value'],
      ['enum E { Value = 0 / 0 }', 'E.Value'],
      ['enum E { Value = 1 / 0 }', 'E.Value'],
      ['enum E { Value = -1 / 0 }', 'E.Value'],
      ["namespace N { export enum E { Value = 'Namespaced' } }", 'N.E.Value'],
    ].flatMap(([declaration, value]) => [
      `${declaration} export const Page = () => <p>Enum {${value}} after</p>;`,
      `${declaration} export const Page = () => <p>{['Enum ', ${value}, ' after']}</p>;`,
      `${declaration} export const Page = () => <p>{${value}}</p>;`,
    ])
  )('extracts enum literals at the host TypeScript stage: %s', (input) => {
    const compiler = extractCompiler(input);
    const cli = extractCli(input);
    expect(compiler.errors).toEqual([]);
    expect(cli.errors).toEqual([]);
    expect(cli.hashes).toEqual(compiler.hashes);
  });

  it.each(examples)('$name', ({ input }) => {
    const compiler = extractCompiler(input);
    const cli = extractCli(input);
    expect(compiler.errors).toEqual([]);
    expect(cli.errors).toEqual([]);
    expect(cli.hashes).toEqual(compiler.hashes);
    expect(cli.hashes.length).toBeGreaterThan(0);
  });

  it.each(
    [
      '-0',
      '-3',
      '3',
      'false',
      'true',
      'null',
      'undefined',
      'NaN',
      'Infinity',
    ].flatMap((value) => [
      `<p>Literal {${value}} after</p>`,
      `<p>{['Literal ', ${value}, ' after']}</p>`,
    ])
  )('preserves special literal extraction: %s', (element) => {
    const input = `export const Page = () => ${element};`;
    const cli = extractCli(input);
    const compiler = extractCompiler(input);
    expect(compiler.errors).toEqual([]);
    expect(cli.errors).toEqual([]);
    expect(cli.hashes).toEqual(compiler.hashes);
  });

  it.each([
    '<p children="Quoted &amp; text"/>',
    '<p children="Line\n    text"/>',
    '<p children="Line\r\n    text"/>',
    '<p children="  Leading and trailing  "/>',
    '<main>Before <p children="Line\n text"/> after</main>',
    '<p children="First"><b>Second {value}</b></p>',
  ])(
    'extracts quoted children using the same lowered string: %s',
    (element) => {
      const input = `const value = 'Ada'; export const Page = () => ${element};`;
      const cli = extractCli(input);
      const compiler = extractCompiler(input);
      expect(cli.errors).toEqual([]);
      expect(compiler.errors).toEqual([]);
      expect(cli.hashes).toEqual(compiler.hashes);
    }
  );

  it.each([`['Sparse ', , value]`, `['Spread ', ...items]`])(
    'does not silently omit unextractable array entries: %s',
    (children) => {
      const input = `const value = 'Ada'; const items = [value]; export const Page = () => <p>{${children}}</p>;`;
      const cli = extractCli(input);
      const compiler = extractCompiler(input);
      expect(cli.errors.length).toBeGreaterThan(0);
      expect(compiler.errors).toEqual([]);
      expect(compiler.entries).toEqual([
        expect.objectContaining({ hash: '', children: undefined }),
      ]);
      expect(cli.hashes).toEqual(compiler.hashes);
    }
  );
});
