import { describe, expect, it } from 'vitest';
import { transformSync } from '@swc/core';
import generate from '@babel/generator';
import * as t from '@babel/types';
import {
  canonical,
  hasUnnormalizedJsxDevelopmentMetadata,
  lower,
  oracle,
  readableOutput,
} from './oracle';
import { cliOutput, cliResult } from './cli-oracle';

describe('parity comparison preserves user semantics', () => {
  it.each([
    ['<div key={void track()}>Hello</div>', '<div>Hello</div>'],
    [
      'export const _jsxFileName = track(); <div>Hello</div>',
      '<div>Hello</div>',
    ],
    [
      '<div children="Hello" {...props} />',
      '<div {...props} children="Hello" />',
    ],
    ['<div children="Hello">World</div>', '<div>Hello World</div>'],
    ['<div>{["Hello", value]}</div>', '<div>{[["Hello", value]]}</div>'],
    ['import "gt-next"; <div>Hello</div>', '<div>Hello</div>'],
    ['function jsx() { return track(); } jsx();', 'track();'],
    [
      'import {createElement as make} from "react"; export const factory=make; export function render(make){ const file="user-file"; return make("div",{__source:{fileName:file,lineNumber:1,columnNumber:2},__self:this,value}); }',
      'import {createElement as make} from "react"; export const factory=make; export function render(make){ const file="user-file"; return make("div",{__source:{fileName:file,lineNumber:99,columnNumber:2},__self:this,value}); }',
    ],
    [
      'import {jsx as helper} from "react/jsx-runtime"; const $jsx = local; export const Keep = helper; export const Page = () => <p>Value {$jsx(value)}</p>;',
      'import {jsx as helper} from "react/jsx-runtime"; const $jsx = local; export const Keep = helper; export const Page = () => <p>Value {helper(value)}</p>;',
    ],
    ...['jsx', 'jsxs', 'jsxDEV'].map((helper) => {
      const source =
        helper === 'jsxDEV' ? 'react/jsx-dev-runtime' : 'react/jsx-runtime';
      const prefix = `import {${helper} as make} from "${source}"; export const page = `;
      return [
        `${prefix}make("p", {children: "Hello"}, undefined, track());`,
        `${prefix}make("p", {children: "Hello"}, undefined);`,
      ];
    }),
    [
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; const file = track(); export const page = make("p", {children: "Hello"}, undefined, false, {fileName: file});',
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {children: "Hello"}, undefined);',
    ],
    [
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {}, void 0, false, {fileName:"input.tsx",lineNumber:1,columnNumber:1}, track());',
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {}, void 0, false, {fileName:"input.tsx",lineNumber:1,columnNumber:1}, this);',
    ],
    [
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {}, void 0, false, {fileName:"input.tsx",lineNumber:1,columnNumber:1}, this, track());',
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {}, void 0, false, {fileName:"input.tsx",lineNumber:1,columnNumber:1}, this);',
    ],
    [
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const keep=make; export function Page(make){return make("p", {}, void 0, false, {fileName:"input.tsx",lineNumber:1,columnNumber:1}, this)}',
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const keep=make; export function Page(make){return make("p", {})}',
    ],
    [
      'import {jsx as make} from "react/jsx-runtime"; export const page = make("p", {}, void 0, false, {fileName:"input.tsx",lineNumber:1,columnNumber:1}, this);',
      'import {jsx as make} from "react/jsx-runtime"; export const page = make("p", {});',
    ],
    [
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {}, void 0, false);',
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {});',
    ],
    [
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; var _jsxFileName = track(); export const page = make("p", {}, void 0, false, {fileName:_jsxFileName,lineNumber:1,columnNumber:1}, this);',
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; export const page = make("p", {});',
    ],
    [
      'import {createElement as make} from "react"; const file="user-file"; export const page=make("p",{__source:{fileName:file,[track()]:1},value});',
      'import {createElement as make} from "react"; export const page=make("p",{value});',
    ],
    [
      'const file="user-file"; export const Page=()=> <p {...props} key="fixed" __source={{fileName:file,[track()]:1}}>Hello</p>;',
      'export const Page=()=> <p {...props} key="fixed">Hello</p>;',
    ],
    [
      'import {createElement as make} from "react"; const file="input.tsx"; export const page=make("p",{__source:{fileName:file,lineNumber:1,columnNumber:1},value});',
      'import {createElement as make} from "react"; export const page=make("p",{value});',
    ],
    [
      'import {createElement as make} from "react"; var _jsxFileName="input.tsx"; _jsxFileName=track(); export const page=make("p",{__source:{fileName:_jsxFileName,lineNumber:1,columnNumber:1},value});',
      'import {createElement as make} from "react"; var _jsxFileName="input.tsx"; _jsxFileName=track(); export const page=make("p",{value});',
    ],
    [
      'import {createElement as make} from "react"; export const page=make("p",{__source:{fileName:"input.tsx",[track()]:1,columnNumber:1},value});',
      'import {createElement as make} from "react"; export const page=make("p",{value});',
    ],
    [
      'import {createElement as make} from "react"; export const page=make("p",{__source:{fileName:"input.tsx",lineNumber:1,columnNumber:1,custom:2},value});',
      'import {createElement as make} from "react"; export const page=make("p",{value});',
    ],
  ])('distinguishes %s', (first, second) => {
    expect(canonical(lower(first))).not.toBe(canonical(lower(second)));
  });

  it.each([
    '<div children="Hello" {...props} />',
    '<div children="Hello">World</div>',
    '<div key={void track()}>Hello</div>',
    '<div key="before" {...props}>Hello</div>',
    '<div>{["Hello", value]}</div>',
    'export const _jsxFileName = track(); <div>Hello</div>',
  ])('roundtrips the compiler-authored fixture for %s', (input) => {
    const expected = oracle(input);
    expect(canonical(lower(readableOutput(expected)))).toBe(
      canonical(expected)
    );
  });

  it.each([
    'export const Page = () => <p>Hello {name}</p>;',
    'export const Page = () => <p {...props} key="fixed">Hello</p>;',
    'class Page extends Base { constructor() { super(<p>Hello</p>); } }',
    'class Page extends Base { constructor() { super(<p {...props} key="fixed">Hello</p>); } }',
    'export const _jsxFileName = track(); export const Page = () => <p>Hello {name}</p>;',
    'export const Page = () => <><>Hello {name}</><b>More {value}</b></>;',
    'export const Page = () => <main>{ok ? <>Hello {name}</> : <><b>Goodbye</b> {value}</>}</main>;',
  ])('normalizes inert Babel and SWC development metadata for %s', (input) => {
    expect(canonical(oracle(input, true))).toBe(canonical(oracle(input)));
    const host = (development: boolean) =>
      transformSync(input, {
        filename: 'input.tsx',
        swcrc: false,
        configFile: false,
        jsc: {
          target: 'esnext',
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic', development } },
        },
      }).code;
    expect(canonical(lower(host(true)))).toBe(canonical(lower(host(false))));
  });

  it.each(['GtInternalTranslateJsx', 'GtInternalVar'])(
    'normalizes source-less SWC development wrappers for %s',
    (component) => {
      const imports = `import {jsxDEV as make} from "react/jsx-dev-runtime"; import {${component} as Wrapper} from "gt-next";`;
      const expected = canonical(
        lower(`${imports}export const page = make(Wrapper, {children:value});`)
      );
      for (const self of ['this', 'void 0'])
        expect(
          canonical(
            lower(
              `${imports}export const page = make(Wrapper, {children:value}, void 0, false, void 0, ${self});`
            )
          )
        ).toBe(expected);
      for (const args of [
        'void track(), false, void 0, this',
        'void 0, track(), void 0, this',
        'void 0, false, void track(), this',
        'void 0, false, void 0, track()',
        'void 0, false, void 0, this, track()',
      ])
        expect(
          canonical(
            lower(
              `${imports}export const page = make(Wrapper, {children:value}, ${args});`
            )
          )
        ).not.toBe(expected);
    }
  );

  it('preserves source-less development arguments for shadowed internal helpers', () => {
    const prefix =
      'import {jsxDEV as make} from "react/jsx-dev-runtime"; import {GtInternalVar as Wrapper} from "gt-next"; export const keep=Wrapper; export const page = (Wrapper) => ';
    expect(
      canonical(
        lower(
          `${prefix}make(Wrapper, {children:value}, void 0, false, void 0, this);`
        )
      )
    ).not.toBe(canonical(lower(`${prefix}make(Wrapper, {children:value});`)));
  });

  it('normalizes only inert four-argument runtime Fragment calls', () => {
    const imports =
      'import {jsxDEV as make, Fragment as Group} from "react/jsx-dev-runtime";';
    const expected = canonical(
      lower(`${imports}export const page = make(Group, {children:value});`)
    );
    for (const flag of ['false', 'true'])
      expect(
        canonical(
          lower(
            `${imports}export const page = make(Group, {children:value}, void 0, ${flag});`
          )
        )
      ).toBe(expected);
    for (const args of [
      'void track(), false',
      'void 0, track()',
      'void 0, false, track()',
    ])
      expect(
        canonical(
          lower(
            `${imports}export const page = make(Group, {children:value}, ${args});`
          )
        )
      ).not.toBe(expected);
  });

  it.each(['Group', 'make'])(
    'preserves development arguments when %s shadows the runtime import',
    (shadow) => {
      const prefix = `import {jsxDEV as make, Fragment as Group} from "react/jsx-dev-runtime"; export const keep = [make, Group]; export const page = (${shadow}) => `;
      expect(
        canonical(
          lower(`${prefix}make(Group, {children:value}, void 0, false);`)
        )
      ).not.toBe(canonical(lower(`${prefix}make(Group, {children:value});`)));
    }
  );
});

describe('JSX runtime oracle semantics', () => {
  it.each([
    '/** @jsxRuntime classic */ import React from "react";',
    '/** @jsxImportSource @emotion/react */',
    '/** @jsxImportSource preact */',
  ])(
    'prints original JSX only after the compiler proves a runtime no-op: %s',
    (header) => {
      const input =
        header +
        ' export const Page = ({ name }: { name: string }) => <p>Hello {name}</p>;';
      const expected = oracle(input);
      const output = readableOutput(expected, input);
      expect(output).toContain('<p>Hello {name}</p>');
      expect(output).not.toContain('GtInternalTranslateJsx');
      expect(canonical(lower(output))).toBe(canonical(expected));
    }
  );

  it('keeps the compiler-authored inserted output when the original JSX changed', () => {
    const input =
      '/** @jsxImportSource react */ export const Page = () => <p>Hello {name}</p>;';
    const expected = oracle(input);
    const output = readableOutput(expected, input);
    expect(output).toContain('<GtInternalTranslateJsx>');
    expect(canonical(lower(output))).toBe(canonical(expected));
  });

  it.each([
    {
      pragma: '/** @jsxRuntime classic */',
      imports: 'import React, { unused } from "react";',
      retained: ['React'],
      call: 'React.createElement',
    },
    {
      pragma:
        '/**\n * @jsxRuntime classic\n * @jsx h\n * @jsxFrag Fragment\n */',
      imports: 'import { h, Fragment, unused } from "preact";',
      retained: ['h', 'Fragment'],
      call: 'h(Fragment',
    },
    {
      pragma:
        '/**\n * @jsxRuntime classic\n * @jsx R.createElement\n * @jsxFrag R.Fragment\n */',
      imports: 'import * as R from "react";',
      retained: ['R'],
      call: 'R.createElement(R.Fragment',
    },
    {
      pragma:
        '/**\n * @jsxRuntime classic\n * @jsx make\n * @jsxFrag Group\n */',
      imports:
        'import { createElement as make, Fragment as Group, unused } from "react";',
      retained: ['make', 'Group'],
      call: 'make(Group',
    },
  ])(
    'retains factory imports used only by $call',
    ({ pragma, imports, retained, call }) => {
      const input = [
        pragma,
        'import "./initialize";',
        imports,
        'type Props = { name: string };',
        'export const Page = ({ name }: Props) => <><p>Hello {name}</p></>;',
      ].join('\n');
      const ast = lower(input);
      const actualImports = ast.program.body.filter((statement) =>
        t.isImportDeclaration(statement)
      );
      expect(actualImports[0].source.value).toBe('./initialize');
      expect(
        actualImports.flatMap((statement) =>
          statement.specifiers.map((specifier) => specifier.local.name)
        )
      ).toEqual(retained);
      expect(generate(ast).code).toContain(call);
      expect(canonical(oracle(input))).toBe(canonical(ast));
      expect(canonical(lower(readableOutput(oracle(input))))).toBe(
        canonical(ast)
      );
    }
  );

  it.each([
    '/** @jsxRuntime classic */',
    '/** @jsxImportSource preact */',
    '/** @jsxImportSource @emotion/react */',
    '/** @jsxImportSource react */',
    '// @jsxImportSource preact',
    '/**\n * @jsxRuntime classic\n * @jsx React.createElement\n * @jsxFrag React.Fragment\n */',
  ])(
    'preserves compile-significant comments through both printers: %s',
    (pragma) => {
      const input =
        pragma +
        '\n/* Ordinary page note. */\nimport React from "react"; export const Page = () => <p>Hello {name}</p>;';
      for (const output of [readableOutput(oracle(input)), cliOutput(input)]) {
        for (const directive of pragma.match(
          /@jsx(?:ImportSource|Runtime|Frag)?\s+[^\s*]+/g
        ) ?? [])
          expect(output).toContain(directive);
        expect(output).not.toContain('Ordinary page note');
      }
      expect(canonical(lower(readableOutput(oracle(input))))).toBe(
        canonical(oracle(input))
      );
    }
  );

  it.each([
    '/** @jsxRuntime classic */',
    '/** @jsxImportSource preact */',
    '/** @jsxImportSource @emotion/react */',
  ])('exposes actual compiler/CLI runtime differences for %s', (pragma) => {
    const input =
      pragma +
      '\nimport React from "react"; export const Page = () => <p>Hello {name}</p>;';
    expect(canonical(oracle(input))).toBe(canonical(lower(input)));
    expect(canonical(oracle(input))).not.toContain(
      '$gtParityGtInternalTranslateJsx'
    );
    const cli = cliResult(input);
    expect(cli.output).toContain('GtInternalTranslateJsx');
    expect(cli.canonical).not.toBe(canonical(oracle(input)));
  });

  it.each([
    '/** @jsxRuntime automatic */',
    '/** @jsxImportSource react */',
    '/** @jsxImportSource preact */\n/** @jsxImportSource react */',
    '/** @jsxRuntime classic */\n/** @jsxRuntime automatic */',
  ])('keeps React automatic insertion enabled for %s', (pragma) => {
    const input = pragma + '\nexport const Page = () => <p>Hello {name}</p>;';
    expect(canonical(oracle(input))).toContain(
      '$gtParityGtInternalTranslateJsx'
    );
    expect(cliResult(input).canonical).toBe(canonical(oracle(input)));
  });

  it.each([
    '/** @jsxRuntime classic */\nimport React from "react";',
    '/**\n * @jsxRuntime classic\n * @jsx make\n */ import { createElement as make } from "react";',
    '/** @jsxImportSource preact */',
    '/** @jsxImportSource @emotion/react */',
  ])('keeps non-normalized development metadata visible for %s', (header) => {
    const input =
      header + '\nexport const Page = () => <><p>Hello {name}</p></>;';
    const development = oracle(input, true);
    expect(hasUnnormalizedJsxDevelopmentMetadata(development)).toBe(true);
    expect(canonical(development)).not.toBe(canonical(oracle(input)));
  });

  it.each([
    'export const Page = () => <><p>Hello {name}</p></>;',
    '/** @jsxImportSource react */ export const Page = () => <p>Hello {name}</p>;',
  ])(
    'recognizes already-normalized React development metadata for %s',
    (input) => {
      const development = oracle(input, true);
      expect(hasUnnormalizedJsxDevelopmentMetadata(development)).toBe(false);
      expect(canonical(development)).toBe(canonical(oracle(input)));
    }
  );

  it('does not treat pragma-like string contents as compiler directives', () => {
    const input =
      'export const notice = "@jsxRuntime classic"; export const Page = () => <p>Hello {name}</p>;';
    expect(canonical(oracle(input))).toContain(
      '$gtParityGtInternalTranslateJsx'
    );
  });
});
