import type { Example } from '../types';
import { runtimeScopeExamples } from '../runtime-scope-inputs';

const profiles = [
  {
    name: 'jsx',
    imports: "import { jsx as make } from 'react/jsx-runtime';",
    single: (type: string, props: string) => `make(${type}, ${props})`,
    multi: (type: string, props: string) => `make(${type}, ${props})`,
  },
  {
    name: 'jsxs',
    imports: "import { jsxs as make } from 'react/jsx-runtime';",
    single: (type: string, props: string) => `make(${type}, ${props})`,
    multi: (type: string, props: string) => `make(${type}, ${props})`,
  },
  {
    name: 'jsxdev',
    imports: "import { jsxDEV as make } from 'react/jsx-dev-runtime';",
    single: (type: string, props: string) =>
      `make(${type}, ${props}, key(), false, source, self)`,
    multi: (type: string, props: string) =>
      `make(${type}, ${props}, key(), true, source, self)`,
  },
];

export const examples: Example[] = profiles.flatMap((profile) => {
  const one = profile.single;
  const many = profile.multi;
  const cases: [string, string][] = [
    ['static', one('"p"', '{ children: "Already lowered" }')],
    ['array', many('"p"', '{ children: ["Before", value, "After"] }')],
    [
      'nested',
      one(
        '"main"',
        `{ children: ${many('"p"', '{ children: ["Nested", value] }')} }`
      ),
    ],
    [
      'mixed-parent',
      `<p>Intro {${one('"b"', '{ children: "Already lowered" }')}} tail</p>`,
    ],
    ['mixed-child', one('"div"', '{ children: <p>Raw JSX {value}</p> }')],
    [
      'manual-translation',
      one('T', '{ children: <p>Manual content {value}</p> }'),
    ],
    [
      'manual-variable',
      one(
        'Var',
        '{ children: ready ? <p>Opaque {value}</p> : <i>Fallback</i>, title: <b>Opaque attribute</b> }'
      ),
    ],
    [
      'opaque-props',
      one(
        'Branch',
        '{ branch: mode, summary: <p>Summary {value}</p>, detail: data, children: fallback }'
      ),
    ],
    [
      'ordinary-content-prop',
      `<Branch branch={mode} summary={${one('"p"', '{ children: ["Summary", value] }')}} />`,
    ],
    [
      'conditional',
      `<p>Conditional {ready ? ${one('"b"', '{ children: "Ready" }')} : ${one('"i"', '{ children: "Waiting" }')}}</p>`,
    ],
    [
      'props-order',
      one('"p"', '{ children: ["First", value], ...props, children: "Last" }'),
    ],
    ['quoted-children', one('"p"', '{ "children": ["Quoted", value] }')],
    [
      'spread-component-argument',
      one(
        '...types',
        '{ children: "Unknown shell", title: <b>Independent JSX</b> }'
      ),
    ],
    ['computed-children', one('"p"', '{ [children]: ["Computed", value] }')],
    [
      'spread-children',
      one(
        '"p"',
        '{ ...{ children: "Not flattened" }, title: <b>Independent {value}</b> }'
      ),
    ],
    [
      'helper-identity',
      `(() => { const identity = make; return [identity, ${one('"p"', '{ children: "Identity" }')}]; })()`,
    ],
    [
      'shadowed-helper',
      `((make) => <p>Local function {${one('"b"', '{ children: "Local call" }')}}</p>)(localFactory)`,
    ],
  ];
  return cases.map(([name, expression]) => ({
    name: `runtime-calls/${profile.name}-${name}`,
    input: `${profile.imports}\nimport { T, Var, Branch } from 'gt-next';\nexport const Page = () => (${expression});\n`,
  }));
});

for (const [helper, counterpart] of [
  ['single', 'multi'],
  ['multi', 'single'],
] as const) {
  for (const [kind, declaration] of [
    ['function', `const ${counterpart} = function () {};`],
    ['arrow', `const ${counterpart} = () => null;`],
    ['class', `const ${counterpart} = class {};`],
  ]) {
    examples.push({
      name: `runtime-calls/shadowed-${counterpart}-${kind}-name`,
      input: `import { jsx as single, jsxs as multi } from 'react/jsx-runtime';
export const runtimeHelper = ${counterpart};
export function Page() {
  ${declaration}
  return {
    name: ${counterpart}.name,
    node: ${helper}('div', { children: ['Hello', ${counterpart}.name] }),
  };
}
`,
    });
  }
}

examples.push(...runtimeScopeExamples);
