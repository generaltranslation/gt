import { describe, expect, it } from 'vitest';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { parse } from '@babel/parser';
import { fileURLToPath } from 'node:url';
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

function deriveExtraction(input: string, auto: boolean) {
  const ast = auto
    ? cliOracle(input)
    : parse(input, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const pkgs = GT_LIBRARIES_UPSTREAM[Libraries.GT_NEXT];
  const { importAliases, translationComponentPaths } = getPathsAndAliases(
    ast,
    pkgs
  );
  for (const { localName, originalName } of translationComponentPaths)
    importAliases[localName] = originalName;
  const updates: Updates = [];
  const errors: string[] = [];
  const warnings = new Set<string>();
  for (const { localName, originalName, path } of translationComponentPaths) {
    if (auto && originalName !== 'GtInternalTranslateJsx') continue;
    parseTranslationComponent({
      originalName,
      localName,
      path,
      updates,
      config: {
        importAliases,
        parsingOptions: { conditionNames: ['import', 'require'] },
        pkgs,
        file: fileURLToPath(import.meta.url),
        includeSourceCodeContext: false,
        enableAutoJsxInjection: auto,
      },
      output: { errors, warnings, unwrappedExpressions: [] },
    });
  }
  return {
    errors,
    warnings: [...warnings],
    hashes: [
      ...new Set(
        updates.map((update) =>
          hashSource({ dataFormat: 'JSX', source: update.source })
        )
      ),
    ].sort(),
  };
}

function extraction(input: string) {
  const compilerAst = oracle(input);
  const compilerState = initializeState(
    {
      enableAutoJsxInjection: true,
      enableMacroTransform: false,
      compileTimeHash: true,
      autoderive: false,
      logLevel: 'silent',
    },
    '/input.tsx'
  );
  traverse(compilerAst, collectionPass(compilerState));
  const ast = cliOracle(input);
  const before = generate(ast, { comments: true }).code;
  const pkgs = GT_LIBRARIES_UPSTREAM[Libraries.GT_NEXT];
  const { importAliases, translationComponentPaths } = getPathsAndAliases(
    ast,
    pkgs
  );
  for (const { localName, originalName } of translationComponentPaths)
    importAliases[localName] = originalName;
  function collect() {
    const updates: Updates = [];
    const errors: string[] = [];
    const warnings = new Set<string>();
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
        output: { errors, warnings, unwrappedExpressions: [] },
      });
    }
    return {
      errors,
      warnings: [...warnings],
      hashes: [
        ...new Set(
          updates.map((update) =>
            hashSource({ dataFormat: 'JSX', source: update.source })
          )
        ),
      ].sort(),
    };
  }
  const cli = collect();
  expect(collect()).toEqual(cli);
  expect(generate(ast, { comments: true }).code).toBe(before);
  return {
    cli,
    compiler: {
      errors: compilerState.errorTracker.getErrors(),
      hashes: [
        ...new Set(
          compilerState.stringCollector
            .getAllTranslationJsx()
            .map((entry) => entry.hash)
        ),
      ].sort(),
    },
  };
}

const cases = [
  {
    name: 'computed component member',
    source:
      "import {jsx as h} from 'react/jsx-runtime'; export const Page = () => h(components[h('span',{children:'Component key'})], {children:'Body text'});",
  },
  {
    name: 'component member with expression object',
    source:
      "import {jsx as h} from 'react/jsx-runtime'; export const Page = () => h(factory(h('span',{children:'Component factory'})).Item, {children:'Body text'});",
  },
  {
    name: 'nested object spread expression',
    source:
      "import {jsx as h} from 'react/jsx-runtime'; export const Page = () => h('main', {...{slot:h('p',{children:'Spread nested text'})}, children:'Body text'});",
  },
  {
    name: 'computed property expression',
    source:
      "import {jsx as h} from 'react/jsx-runtime'; export const Page = () => h('main', {[h('p',{children:'Property key'})]:'value', children:'Body text'});",
  },
  {
    name: 'runtime key and development metadata',
    source:
      "import {jsxDEV as h} from 'react/jsx-dev-runtime'; export const Page = () => h('main', {children:'Body text'}, h('p',{children:'Key text'},undefined,false), false, {fileName:h('i',{children:'Metadata text'},undefined,false)}, this);",
  },
  {
    name: 'raw fragment',
    source:
      'export const Page = () => <main>Before <>Fragment <b>Bold text</b></> after</main>;',
  },
  {
    name: 'named fragment',
    source:
      "import {Fragment} from 'react'; export const Page = () => <main>Before <Fragment>Fragment <b>Bold text</b></Fragment> after</main>;",
  },
  {
    name: 'aliased fragment',
    source:
      "import {Fragment as Group} from 'react'; export const Page = () => <main>Before <Group>Fragment <b>Bold text</b></Group> after</main>;",
  },
  {
    name: 'namespace fragment',
    source:
      "import * as React from 'react'; export const Page = () => <main>Before <React.Fragment>Fragment <b>Bold text</b></React.Fragment> after</main>;",
  },
  {
    name: 'shadowed Var',
    source:
      "import {Var} from 'gt-next'; export function Page({Var, value}) {return <main>Hello <Var>Local text {value}</Var> after</main>;}",
  },
  {
    name: 'shadowed aliased Var',
    source:
      "import {Var as Value} from 'gt-next'; export function Page({Value, value}) {return <main>Hello <Value>Local text {value}</Value> after</main>;}",
  },
  {
    name: 'shadowed Branch',
    source:
      "import {Branch} from 'gt-next'; export function Page({Branch, value}) {return <main>Hello <Branch branch={value}>Local text {value}</Branch> after</main>;}",
  },
  {
    name: 'shadowed T',
    source:
      "import {T} from 'gt-next'; export function Page({T, value}) {return <main>Hello <T>Local text {value}</T> after</main>;}",
  },
  {
    name: 'comments and type preservation',
    source:
      '/** @jsxImportSource react */\ntype Props = {value:string};\nexport function Page({value}:Props) { /* retain block */ return <main>{[/* first */ "Hello ", value /* second */] satisfies unknown[]}</main>; }',
  },
  {
    name: 'typed children prop',
    source:
      'export function Page({value}:{value:string}) {return <main children={(["Typed ", value] as const) satisfies readonly unknown[]}/>;}',
  },
];

for (const component of [
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
  'Derive',
]) {
  cases.push({
    name: `shadowed ${component}`,
    source: `import {${component}} from 'gt-next'; export function Page({${component}, value}) {return <main>Before <${component}>Local text {value}</${component}> after</main>;}`,
  });
}
for (const component of ['Branch', 'Plural']) {
  cases.push({
    name: `shadowed ${component} with branching props`,
    source: `import {${component}} from 'gt-next'; export function Page({${component}, value}) {return <main>Before <${component} branch={value} n={value} one={<b>One {value}</b>} yes={<i>Yes {value}</i>}>Local text {value}</${component}> after</main>;}`,
  });
}
cases.push(
  {
    name: 'unrelated Var when GT Var is aliased',
    source:
      "import {Var as ActualVar} from 'gt-next'; export function Page({Var, value}) {return <main>Before <Var>Local text {value}</Var><ActualVar>{value}</ActualVar> after</main>;}",
  },
  {
    name: 'shadowed and imported Var in separate scopes',
    source:
      "import {Var} from 'gt-next'; export function Page({Var, value}) {return <main>Before <Var>Local text {value}</Var> after</main>;} export const Other = ({value}) => <main>Other <Var>{value}</Var> after</main>;",
  },
  {
    name: 'unrelated local Branch',
    source:
      "import Branch from './ordinary-branch'; export function Page({value}) {return <main>Before <Branch yes='Yes text' branch={value}>Local text {value}</Branch> after</main>;}",
  },
  {
    name: 'unrelated local Plural',
    source:
      "import Plural from './ordinary-plural'; export function Page({value}) {return <main>Before <Plural one='One text' n={value}>Local text {value}</Plural> after</main>;}",
  },
  {
    name: 'manual Var with shadowed JSX runtime helper',
    source:
      "import {jsx as h} from 'react/jsx-runtime'; import {Var} from 'gt-next'; export function Page({h, value}) {return <main>Hello <Var>{h('style',{children:value})}</Var> after</main>;}",
  },
  {
    name: 'bound Branch with duplicate children and spreads',
    source:
      "import {Branch} from 'gt-next'; export const Page = ({value}) => <main>Before <Branch {...{branch:value,children:'First ',yes:<b>Yes {value}</b>}} children='Second '>Third {value}</Branch> after</main>;",
  },
  {
    name: 'bound Plural with inline spread and control props',
    source:
      "import {Plural} from 'gt-next'; export const Page = ({value}) => <main>Before <Plural {...{n:value,locales:'en',one:<b>One {value}</b>,other:<i>Many {value}</i>}}>Fallback {value}</Plural> after</main>;",
  },
  {
    name: 'inline spread HTML content prop',
    source:
      'export const Page = () => <main>Before <span {...{title:"Hovered text", "aria-label":"Accessible text"}}>Inside</span> after</main>;',
  },
  {
    name: 'duplicate HTML content prop across an inline spread',
    source:
      'export const Page = () => <main>Before <span title="First" {...{title:"Middle"}} title="Last">Inside</span> after</main>;',
  },
  {
    name: 'authored runtime call retains opaque spread props',
    source:
      "import {jsx as h,jsxs as hs} from 'react/jsx-runtime'; export const Page = () => hs('main',{children:['Before ',h('span',{...{title:'Opaque title'},children:'Inside'}),' after']});",
  },
  {
    name: 'inline proto spread stays opaque',
    source:
      'export const Page = () => <main>Before <span {...{__proto__:{title:"Inherited title"},title:"Own title"}}>Inside</span> after</main>;',
  }
);

describe('independent automatic JSX extraction review', () => {
  it.each(cases)('$name', ({ source }) => {
    const result = extraction(source);
    expect(result.compiler.errors).toEqual([]);
    expect(result.cli.errors).toEqual([]);
    expect(result.cli.hashes).toEqual(result.compiler.hashes);
  });

  it('retains nested extraction in a conditional component type', () => {
    const result = extraction(
      "import {jsx as h} from 'react/jsx-runtime'; export const Page = () => h(select(h('span',{children:'Selector text'})) ? A : B, {children:'Body text'});"
    );
    // The compiler's existing build validator rejects a conditional component
    // type; independently inserted text units must still remain discoverable.
    expect(result.cli.errors).toEqual([]);
    expect(result.cli.hashes).toEqual(result.compiler.hashes);
  });

  it('does not reuse manual Derive parsing in the automatic extraction view', () => {
    const file = JSON.stringify(
      fileURLToPath(
        new URL('./cli-extraction-fixtures/derived-values.tsx', import.meta.url)
      )
    );
    const manual = deriveExtraction(
      `import {T,Derive} from 'gt-next'; import {manualFirst} from ${file}; export const Page = () => <T><Derive>{manualFirst()}</Derive></T>;`,
      false
    );
    const cached = deriveExtraction(
      `import {Derive} from 'gt-next'; import {manualFirst} from ${file}; export const Page = () => <main>Before <Derive>{manualFirst()}</Derive> after</main>;`,
      true
    );
    const fresh = deriveExtraction(
      `import {Derive} from 'gt-next'; import {freshAuto} from ${file}; export const Page = () => <main>Before <Derive>{freshAuto()}</Derive> after</main>;`,
      true
    );
    expect(manual.errors).toEqual([]);
    expect(cached.errors).toEqual([]);
    expect(fresh.errors).toEqual([]);
    expect(fresh.hashes.length).toBeGreaterThan(0);
    expect(cached.hashes).toEqual(fresh.hashes);
  });
});
