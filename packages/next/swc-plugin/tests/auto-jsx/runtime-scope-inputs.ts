import type { Example } from './types';

const children = [
  ['array', '["Text", value]'],
  ['single-array', '["Text"]'],
  ['sparse-array', '["Text", , value]'],
  ['spread-array', '["Text", ...values]'],
  ['raw-jsx', '<p>Raw {value}</p>'],
  ['single-call', 'single("i", { children: ["Single", value] })'],
  ['multi-call', 'multi("i", { children: ["Multi", value] })'],
  ['dev-call', 'dev("i", { children: ["Dev", value] }, void 0, true)'],
] as const;

const imports = `import { jsx as single, jsxs as multi } from 'react/jsx-runtime';
import { jsxDEV as dev } from 'react/jsx-dev-runtime';
import { T, Var, Branch } from 'gt-next';
export const runtimeHelpers = [single, multi, dev];
`;

const contexts = [
  'parameter-single',
  'parameter-multi',
  'parameter-dev',
  'local-multi',
  'props-assertion',
  'duplicate-children',
  'manual-translation',
  'branch-runtime',
  'attribute-runtime',
] as const;

export const runtimeScopeExamples: Example[] = [];
export const assertedRuntimeCalleeExamples: Example[] = [];

for (const helper of ['single', 'multi', 'dev']) {
  for (const [childName, child] of children) {
    for (const context of contexts) {
      const call = `${helper}('div', { children: ${child} }, key(), true, source(), self())`;
      let body: string;
      if (context.startsWith('parameter-')) {
        body = `export function Page(${context.slice(10)}) { return ${call}; }`;
      } else if (context === 'local-multi') {
        body = `export function Page() { const multi = localFactory; return [multi, ${call}]; }`;
      } else if (context === 'props-assertion') {
        body = `export const Page = () => ${helper}('div', ({ children: ${child} } as Record<string, unknown>), key(), true, source(), self());`;
      } else if (context === 'duplicate-children') {
        body = `export const Page = () => ${helper}('div', { children: ${child}, ...props, children: ['Last', value] }, key(), true, source(), self());`;
      } else if (context === 'manual-translation') {
        body = `export const Page = () => single(T, { children: ${call}, title: multi('b', { children: 'Title' }) });`;
      } else if (context === 'branch-runtime') {
        body = `export const Page = () => dev(Branch, { branch: mode, first: ${call}, children: 'Fallback' }, void 0, false);`;
      } else {
        body = `export const Page = () => single('p', { title: ${call}, children: 'Body' });`;
      }
      runtimeScopeExamples.push({
        name: `runtime-calls/scope-${helper}-${context}-${childName}`,
        input: imports + body,
      });
    }

    // The native fixture's SWC fixer drops required parentheses around this TS
    // callee even with injection disabled. Actual hosts erase these types before
    // printing; exercise them in both real WASM modes against flag-off baselines.
    assertedRuntimeCalleeExamples.push({
      name: `runtime-assertions/${helper}-${childName}`,
      input:
        imports +
        `export const Page = () => ((${helper} as typeof ${helper})!)('div', { children: ${child} }, key(), true, source(), self());`,
    });
  }
}
