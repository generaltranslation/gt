import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformSync } from '@swc/core';
import { parse } from '@babel/parser';
import { canonicalRuntime, oracleCompiled } from './oracle';
import { cliNextOutput } from './cli-oracle';
import { pluginDirectory } from './workflow';
import { examples as runtimeExamples } from './cases/jsx-runtime';

// These host directives intentionally differ from Babel's directive grammar.
// Keep their real SWC stage coverage separate from the shared Babel oracle.
const inputs = [
  '/** @jsxImportSource @emotion/react */\nexport const Page=()=> <p>Hello {value}</p>;',
  '// @jsxImportSource @emotion/react\nexport const Page=()=> <p>Hello {value}</p>;',
  'const before=1;\n/** @jsxRuntime classic */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxRuntime automatic */ const before=1;\n/** @jsxRuntime classic */\nexport const Page=()=> <p>Hello {value}</p>;',
  'const before=1;\n/** @jsxImportSource react */ const middle=2;\n/** @jsxImportSource @emotion/react */\nexport const Page=()=> <p>Hello {value}</p>;',
  'const before=1; // @jsxRuntime classic\n\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxRuntime classic @jsxImportSource react */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxImportSource react @jsxRuntime classic */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxImportSource @emotion/react @jsxImportSource react */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxImportSource react @jsxImportSource @emotion/react */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxRuntime automatic */\n/** @jsxRuntime classic */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxRuntime classic */\n/** @jsxRuntime automatic */\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxRuntime classic */\n// @jsxRuntime automatic\nexport const Page=()=> <p>Hello {value}</p>;',
  "/** @jsxRuntime classic */\n'use client';\nexport const Page=()=> <p>Hello {value}</p>;",
  "'use client';\n/** @jsxImportSource @emotion/react */\nexport const Page=()=> <p>Hello {value}</p>;",
  'const before=1;\n/** @jsxImportSource @emotion/react */ type Props={};\nexport const Page=()=> <p>Hello {value}</p>;',
  '/** @jsxImportSource @emotion/react */ type Props={};\nexport const Page=()=> <p>Hello {value}</p>;',
  "import {version} from 'react';\n/** @jsxImportSource @emotion/react */ type Props={};\nexport const Page=()=> <p>Hello {value}</p>;",
  '/** @jsxImportSource react */ const before=1;\n/** @jsxImportSource @emotion/react */\nexport const Page=()=> <p>Hello {value}</p>;',
  'export function Page(){ /** @jsxRuntime classic */ return <p>Hello {value}</p>; }',
  ...runtimeExamples
    .filter(({ name }) =>
      /header-(client-directive|side-effect-import)-before-pragma/.test(name)
    )
    .map(({ input }) => input),
  ...[
    'import React from "react";',
    'import * as React from "react";',
    'import {React} from "custom-react";',
    'import R from "react";',
  ].flatMap((declaration) => [
    `'use client';\n/** @jsxImportSource custom-runtime */\n${declaration}\nexport const Page=()=> <p>Hello {value}</p>;`,
    `import './initialize';\n/** @jsxImportSource custom-runtime */\n${declaration}\nexport const Page=()=> <p>Hello {value}</p>;`,
  ]),
];

function host(input: string, development: boolean, enabled = false) {
  return transformSync(input, {
    filename: 'input.tsx',
    swcrc: false,
    configFile: false,
    jsc: {
      target: 'esnext',
      parser: { syntax: 'typescript', tsx: true },
      transform: { react: { runtime: 'automatic', development } },
      ...(enabled && {
        experimental: {
          cacheRoot: path.join(pluginDirectory, 'target/auto-jsx-swc-cache'),
          plugins: [
            [
              path.join(
                pluginDirectory,
                'target/wasm32-wasip1/release/gt_swc_plugin.wasm'
              ),
              {
                enableAutoJsxInjection: true,
                compileTimeHash: false,
              },
            ],
          ],
        },
      }),
    },
    module: { type: 'es6' },
  }).code;
}

const canonical = (code: string) =>
  canonicalRuntime(parse(code, { sourceType: 'module' }));

describe('CLI emitted source preserves actual host JSX directive selection', () => {
  it.each(inputs)(
    'matches insertion after production SWC lowering: %s',
    (input) => {
      expect(canonical(host(cliNextOutput(input), false))).toBe(
        canonicalRuntime(oracleCompiled(host(input, false)))
      );
    }
  );
});

describe.each([false, true])(
  'WASM pragma selection in host development=%s',
  (development) => {
    it.each(inputs)(
      'matches the compiler after actual host lowering: %s',
      (input) => {
        // Both see the same original source, so even custom-runtime development
        // metadata remains part of this exact comparison.
        expect(canonical(host(input, development, true))).toBe(
          canonicalRuntime(oracleCompiled(host(input, development)))
        );
      }
    );
  }
);
