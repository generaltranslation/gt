import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { transformSync } from '@swc/core';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createEnumConstants } from '../../../../cli/src/react/jsx/utils/jsxParsing/autoInsertion/enumConstants';
import { expressionPath } from '../../../../cli/src/react/jsx/utils/jsxParsing/autoInsertion/syntax';
import { canonicalRuntime, oracle, oracleCompiled } from './oracle';
import { cliNextOutput, cliResult } from './cli-oracle';

type EnumCase = {
  name: string;
  declarations: string;
  refs: string[];
  parameters?: string;
  local?: string;
  suffix?: string;
  nextHostUnsupported?: string;
};
const examples: EnumCase[] = [
  { name: 'regular string', declarations: "enum E{A='A'}", refs: ['E.A'] },
  {
    name: 'const numeric',
    declarations: 'const enum E{A=1,B,C=9,D}',
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
  },
  {
    name: 'exported enum',
    declarations: "export enum E{A='A'}",
    refs: ['E.A'],
  },
  {
    name: 'merged declarations',
    declarations: "enum E{A='A'} enum E{B='B'}",
    refs: ['E.A', 'E.B'],
  },
  {
    name: 'merged references',
    declarations: 'enum E{A=2} enum E{B=A+1,C}',
    refs: ['E.A', 'E.B', 'E.C'],
  },
  {
    name: 'merged numeric restart',
    declarations: 'enum E{A=2} enum E{B,C}',
    refs: ['E.A', 'E.B', 'E.C'],
  },
  {
    name: 'merged last value',
    declarations: "enum E{A='A'} enum E{A='B'}",
    refs: ['E.A'],
  },
  {
    name: 'declaration after references',
    declarations: '',
    refs: ['E.A'],
    suffix: "enum E{A='A'}",
  },
  {
    name: 'forward member',
    declarations: 'enum E{A=B,B=3,C=E.D,D=4}',
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
  },
  {
    name: 'cross enum',
    declarations: 'enum Other{A=2} enum E{A=Other.A+1}',
    refs: ['E.A', 'Other.A'],
  },
  {
    name: 'forward cross enum',
    declarations: 'enum E{A=Other.A+1} enum Other{A=2}',
    refs: ['E.A', 'Other.A'],
  },
  {
    name: 'computed reference',
    declarations: "enum E{'A'='A','1'=1}",
    refs: [
      "E['A']",
      'E[`A`]',
      'E[1]',
      "E['1']",
      "E[('A')]",
      "E['A'+'']",
      "E[`A${''}`]",
      '(E).A',
      '(E)["A"]',
      '((E)).A',
      '(E.A)',
      'E?.A',
      'E?.["A"]',
    ],
  },
  {
    name: 'aliased enum stays dynamic',
    declarations: "enum E{A='A'} const F=E;",
    refs: ['F.A'],
  },
  {
    name: 'member mutation does not change host constant',
    declarations: "enum E{A='A'} (E as any).A='Changed';",
    refs: ['E.A'],
  },
  {
    name: 'dynamic initializer',
    declarations: 'enum E{A=getValue(),B,C=4,D=A+1}',
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
  },
  {
    name: 'global constants',
    declarations: 'enum E{A=NaN,B=Infinity,C=-Infinity,D=undefined}',
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
  },
  {
    name: 'ordinary constants stay dynamic',
    declarations: 'const value=2; enum E{A=value,B=Math.PI}',
    refs: ['E.A', 'E.B'],
  },
  {
    name: 'ambient enum stays dynamic',
    declarations: "declare enum E{A='A'}",
    refs: ['E.A'],
  },
  {
    name: 'parameter shadows enum',
    declarations: "enum E{A='A'}",
    parameters: 'E',
    refs: ['E.A'],
  },
  {
    name: 'block shadows enum',
    declarations: "enum E{A='A'}",
    local: "const E={A:'local'};",
    refs: ['E.A'],
  },
  {
    name: 'local enum shadows outer',
    declarations: "enum E{A='A'}",
    local: "enum E{A='local'}",
    refs: ['E.A'],
  },
  {
    name: 'parameter shadows enum globals',
    declarations: '',
    parameters: 'Infinity,NaN',
    local: 'enum E{A=Infinity,B=NaN,C=-Infinity}',
    refs: ['E.A', 'E.B', 'E.C'],
  },
  {
    name: 'parameters shadow module enum special values',
    declarations: 'enum E{A=Infinity,B=NaN,C=-Infinity}',
    parameters: 'Infinity,NaN',
    refs: ['E.A', 'E.B', 'E.C'],
  },
  {
    name: 'function body enum does not shadow parameter default',
    declarations: 'enum E{A=1}',
    parameters: "node=<p data-ref='default'>{E.A}</p>",
    local: "enum E{A='inside'}",
    refs: ['E.A'],
  },
  {
    name: 'function body binding does not shadow parameter default',
    declarations: "enum E{A='outside'}",
    parameters: "node=<p data-ref='default'>{E.A}</p>",
    local: "const E={A:'inside'};",
    refs: ['E.A'],
  },
  {
    name: 'parameter default sees earlier parameter',
    declarations: "enum E{A='outside'}",
    parameters: "E, node=<p data-ref='default'>{E.A}</p>",
    refs: ['E.A'],
  },
  {
    name: 'initializer parentheses',
    declarations: 'enum E{A=2,B=(A),C=(E.A),D=(E).A,F=E[("A")]}',
    refs: ['E.A', 'E.B', 'E.C', 'E.D', 'E.F'],
  },
  {
    name: 'initializer erased syntax',
    declarations:
      "enum E{A=(1 as number),B=('text' as string),C=(3 satisfies number),D=4!}",
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
    // Next 16.2.9's native SWC traps on this original input without GT. The
    // shared SWC host supports it and still exercises classification/runtime.
    nextHostUnsupported:
      'Next 16.2.9 traps on original typed enum initializers before plugins run',
  },
  {
    name: 'namespace enum cannot leak',
    declarations: "namespace N{export enum E{A='A'}}",
    refs: ['E.A', 'N.E.A'],
  },
  {
    name: 'string enum implicit member',
    declarations: "enum E{A='A',B,C=2,D}",
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
  },
  {
    name: 'enum template strings',
    declarations: "enum E{A='A',B=A+'B',C=`C${1}`,D=`D${A}`}",
    refs: ['E.A', 'E.B', 'E.C', 'E.D'],
  },
];

for (const initializer of [
  '-1',
  '+2',
  '~2',
  '1<<3',
  '8>>1',
  '8>>>1',
  '7&3',
  '7^3',
  '1|2',
  '6/2',
  '2**3',
  '5%2',
  '1+2',
  "'A'+'B'",
  "'A'+2",
  "2+'A'",
  '-0',
  '0/0',
  '1/0',
  '-1/0',
  "+'2'",
  "-'2'",
  "~'2'",
  "'2'-1",
  "'2'*2",
  'true+1',
  '1===1',
  '1&&2',
  'null??2',
  '(2+3)*4',
  '2147483648>>0',
  '4294967295>>>0',
  '1<<33',
])
  examples.push({
    name: `initializer ${initializer}`,
    declarations: `enum E{A=${initializer}}`,
    refs: ['E.A'],
  });

function source(example: EnumCase, mixed = false): string {
  return `${example.declarations}
  export function Page(${example.parameters || ''}) {
    ${example.local || ''}
    return <>${example.refs.map((ref, index) => `<p data-ref="${index}">${mixed ? 'Before ' : ''}{${ref}}${mixed ? ' after {dynamic}' : ''}</p>`).join('')}</>;
  }
  ${example.suffix || ''}`;
}

function hostLiteral(node: t.Node): string | number | undefined {
  if (t.isStringLiteral(node) || t.isNumericLiteral(node)) return node.value;
  if (t.isIdentifier(node, { name: 'NaN' })) return NaN;
  if (t.isIdentifier(node, { name: 'Infinity' })) return Infinity;
  if (t.isUnaryExpression(node, { operator: '-' })) {
    if (t.isNumericLiteral(node.argument)) return -node.argument.value;
    if (t.isIdentifier(node.argument, { name: 'Infinity' })) return -Infinity;
  }
}

// These six member syntaxes deliberately compare their actual host stage. The
// pinned standalone @swc/core and Next frontends fold different expressions.
const typedReferences: EnumCase = {
  name: 'typed references retain Next parenthesis and type boundaries',
  declarations: "enum E{A='inside'}",
  refs: [
    'E!.A',
    '(E as typeof E).A',
    "E['A'!]",
    "E['A' as 'A']",
    "E[('A' as 'A')]",
    '(E.A as E.A)',
  ],
};
const nextTypedValues = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  'inside',
];

function sharedTypeScriptOutput(input: string): string {
  return transformSync(input, {
    filename: 'input.tsx',
    swcrc: false,
    configFile: false,
    jsc: {
      target: 'esnext',
      parser: { syntax: 'typescript', tsx: true },
      transform: { react: { runtime: 'preserve' } },
    },
  }).code;
}

function runtimeReferenceValues(code: string): (string | number | undefined)[] {
  const values: (string | number | undefined)[] = [];
  traverse(parse(code, { sourceType: 'module' }), {
    CallExpression(path) {
      const props = path.node.arguments[1];
      if (
        !t.isObjectExpression(props) ||
        !props.properties.some(
          (property) =>
            t.isObjectProperty(property) &&
            t.isStringLiteral(property.key, { value: 'data-ref' })
        )
      )
        return;
      const children = props.properties.find(
        (property) =>
          t.isObjectProperty(property) &&
          t.isIdentifier(property.key, { name: 'children' })
      );
      if (!t.isObjectProperty(children))
        throw new Error('Missing host children');
      values.push(hostLiteral(children.value));
    },
  });
  return values;
}

function references(
  code: string,
  classify?: ReturnType<typeof createEnumConstants>
): (string | number | undefined)[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const values: (string | number | undefined)[] = [];
  const before = generate(ast, { comments: true }).code;
  const resolver = classify || createEnumConstants(ast);
  traverse(ast, {
    JSXElement(path) {
      if (
        !path.node.openingElement.attributes.some(
          (attr) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: 'data-ref' })
        )
      )
        return;
      const child = path.get('children')[0];
      if (!child?.isJSXExpressionContainer())
        throw new Error('Missing reference');
      values.push(resolver(expressionPath(child.get('expression'))));
    },
  });
  expect(generate(ast, { comments: true }).code).toBe(before);
  return values;
}

describe('CLI enum classification matches host TypeScript lowering', () => {
  it.each(examples)('$name', (example) => {
    const input = source(example);
    const output = sharedTypeScriptOutput(input);
    expect(references(input)).toEqual(
      references(output, (path) => hostLiteral(path.node!))
    );
  });

  it('resolves namespace-local enums without exposing them outside that namespace', () => {
    const input =
      "namespace N {export enum E{A='inside'}; export function Inner(){return <p data-ref='0'>{E.A}</p>;}} export const Page=()=> <p data-ref='1'>{N.E.A}</p>;";
    const output = sharedTypeScriptOutput(input);
    expect(references(input)).toEqual(
      references(output, (path) => hostLiteral(path.node!))
    );
  });

  it('records the finite typed-member folding difference between host frontends', () => {
    const input = source(typedReferences);
    expect(references(input)).toEqual(nextTypedValues);
    expect(
      references(sharedTypeScriptOutput(input), (path) =>
        hostLiteral(path.node!)
      )
    ).toEqual(['inside', undefined, 'inside', 'inside', undefined, 'inside']);
  });
});

describe.each([false, true])(
  'CLI enum runtime parity, development=%s',
  (development) => {
    it.each(examples)('$name', (example) => {
      for (const mixed of [false, true]) {
        const input = source(example, mixed);
        expect(cliResult(input, development).runtimeCanonical).toBe(
          canonicalRuntime(oracle(input, development))
        );
      }
    });
  }
);

// Exercise the actual Next TypeScript transform, which runs before the compiler
// sees React calls. The CLI still receives and emits the original typed source.
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
function nextHostOutputs(
  sources: string[],
  development: boolean,
  withPlugin = false
): string[] {
  const outputs = JSON.parse(
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./host/next-transform.mjs', import.meta.url))],
      {
        input: JSON.stringify({
          sourceApp: `${repoRoot}tests/apps/next-app-router/package.json`,
          filename: `${repoRoot}input.tsx`,
          development,
          sources,
          ...(withPlugin && {
            swcPlugin: `${repoRoot}packages/next/dist/gt_swc_plugin.wasm`,
            cacheRoot: `${repoRoot}packages/next/swc-plugin/target/auto-jsx-next-enum-cache`,
          }),
        }),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      }
    )
  );
  expect(outputs).toHaveLength(sources.length);
  return outputs;
}
describe.each([false, true])(
  'Next enum runtime parity, development=%s',
  (development) => {
    let outputs: string[];
    let wasmOutputs: string[];
    const nextExamples = [...examples, typedReferences];
    const supported = nextExamples.filter(
      (example) => !example.nextHostUnsupported
    );
    beforeAll(() => {
      const sources = supported.flatMap((example) =>
        [false, true].flatMap((mixed) => {
          const input = source(example, mixed);
          return [input, cliNextOutput(input)];
        })
      );
      outputs = nextHostOutputs(sources, development);
      wasmOutputs = nextHostOutputs(
        [source(typedReferences), source(typedReferences, true)],
        development,
        true
      );
    });
    for (const example of nextExamples)
      it.skipIf(!!example.nextHostUnsupported)(example.name, () => {
        for (const mixed of [0, 1]) {
          const index = supported.indexOf(example) * 4 + mixed * 2;
          const [compilerHost, cliHost] = outputs.slice(index, index + 2);
          if (example === typedReferences && mixed === 0)
            expect(runtimeReferenceValues(compilerHost)).toEqual(
              nextTypedValues
            );
          expect(
            canonicalRuntime(parse(cliHost, { sourceType: 'module' }))
          ).toBe(canonicalRuntime(oracleCompiled(compilerHost)));
        }
      });
    it('matches SWC and compiler after the same Next typed-member lowering', () => {
      for (const mixed of [0, 1]) {
        const index = supported.indexOf(typedReferences) * 4 + mixed * 2;
        expect(
          canonicalRuntime(parse(wasmOutputs[mixed], { sourceType: 'module' }))
        ).toBe(canonicalRuntime(oracleCompiled(outputs[index])));
      }
    });
  }
);
