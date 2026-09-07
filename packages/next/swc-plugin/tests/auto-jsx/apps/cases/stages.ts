import type { ParityApp } from '../types';

const props = `type Props = { count: number; selected: string; shown: boolean; label: string };`;
const indices = Array.from({ length: 16 }, (_, index) => index + 1);

const styledCases = indices.map((index) => `styled-${index}`);
const styles = [
  '.copy { color: rgb(17, 34, 51); }',
  '.copy { padding-left: ${count}px; }',
  '.copy strong { font-weight: 600; }',
  '.copy::before { content: "["; } .copy::after { content: "]"; }',
  '@media (min-width: 1px) { .copy { margin-top: 2px; } }',
  '.copy { --fixture-space: 3px; padding-top: var(--fixture-space); }',
  '.copy { color: ${shown ? "rgb(10, 30, 50)" : "rgb(50, 30, 10)"}; }',
  '.copy { border-left: 1px solid rgb(4, 5, 6); }',
  '.copy[data-selected="details"] { font-style: italic; }',
  '.copy { white-space: pre-wrap; }',
  '.copy strong + em { text-decoration: underline; }',
  '.copy { letter-spacing: ${count / 10}px; }',
  ':global(.fixture-global) { border-radius: 2px; }',
  '.copy { background: linear-gradient(90deg, transparent, rgb(240, 240, 240)); }',
  '.copy:hover, .copy:focus { outline: 1px dotted currentColor; }',
  '@supports (display: grid) { .copy { display: block; } }',
];
const styledSource = `'use client';
${props}
${indices
  .map(
    (
      index
    ) => `function Styled${index}({ count, selected, shown, label }: Props) {
  return <section data-case="styled-${index}" className="fixture-global">
    <h2>Styled panel ${index} for {label}</h2>
    <p className="copy" data-selected={selected}>Visible {count} <strong>units</strong><em>{shown ? ' shown' : ' hidden'}</em></p>
    <style jsx>{\`${styles[index - 1]}\`}</style>
  </section>;
}`
  )
  .join('\n')}
export function Suite(props: Props) {
  return <main>${indices.map((index) => `<Styled${index} {...props} />`).join('')}</main>;
}`;

const runtimeProfiles = [
  { name: 'default', comment: '' },
  { name: 'react', comment: '/** @jsxImportSource react */' },
  {
    name: 'classic',
    // Keep an explicit value use so the host TypeScript pass retains React.
    comment:
      '/** @jsxRuntime classic */\nimport * as React from "react";\nexport const classicReact = React;',
  },
  {
    name: 'custom',
    comment: '/** @jsxImportSource ./custom-runtime */',
  },
] as const;
const runtimeCases = runtimeProfiles.flatMap(({ name }) =>
  [1, 2, 3, 4].map((index) => `runtime-${name}-${index}`)
);
const runtimeFiles: Record<string, string> = {
  'node_modules/@parity/runtime/package.json': JSON.stringify({
    name: '@parity/runtime',
    version: '1.0.0',
    type: 'module',
    exports: {
      './jsx-runtime': './jsx-runtime.js',
      './jsx-dev-runtime': './jsx-dev-runtime.js',
    },
  }),
  'node_modules/@parity/runtime/jsx-runtime.js': `import * as runtime from 'react/jsx-runtime';
export const Fragment = runtime.Fragment;
function propsFor(type, props) { return typeof type === 'string' && props['data-case'] ? { ...props, 'data-runtime-kind': 'project', style: { ...props.style, textIndent: '1px' } } : props; }
export function jsx(type, props, ...rest) { return runtime.jsx(type, propsFor(type, props), ...rest); }
export function jsxs(type, props, ...rest) { return runtime.jsxs(type, propsFor(type, props), ...rest); }`,
  'node_modules/@parity/runtime/jsx-dev-runtime.js': `import * as runtime from 'react/jsx-dev-runtime';
export const Fragment = runtime.Fragment;
export function jsxDEV(type, props, ...rest) { return runtime.jsxDEV(type, typeof type === 'string' && props['data-case'] ? { ...props, 'data-runtime-kind': 'project', style: { ...props.style, textIndent: '1px' } } : props, ...rest); }`,
  'src/Suite.tsx': `${props}
${runtimeProfiles.map(({ name }, index) => `import { Runtime as Runtime${index} } from './runtime-${name}';`).join('\n')}
export function Suite(props: Props) { return <main>${runtimeProfiles.map((_, index) => `<Runtime${index} {...props} />`).join('')}</main>; }`,
  'src/custom-runtime/jsx-runtime.js': `import * as runtime from 'react/jsx-runtime';
export const Fragment = runtime.Fragment;
export function jsx(type, props, ...rest) { return runtime.jsx(type, typeof type === 'string' ? { ...props, 'data-runtime-kind': 'custom' } : props, ...rest); }
export function jsxs(type, props, ...rest) { return runtime.jsxs(type, typeof type === 'string' ? { ...props, 'data-runtime-kind': 'custom' } : props, ...rest); }`,
  'src/custom-runtime/jsx-dev-runtime.js': `import * as runtime from 'react/jsx-dev-runtime';
export const Fragment = runtime.Fragment;
export function jsxDEV(type, props, ...rest) { return runtime.jsxDEV(type, typeof type === 'string' ? { ...props, 'data-runtime-kind': 'custom' } : props, ...rest); }`,
};
for (const { name, comment } of runtimeProfiles) {
  runtimeFiles[`src/runtime-${name}.tsx`] = `${comment}
${props}
export function Runtime({ count, selected, shown, label }: Props) { return <>
  <section data-case="runtime-${name}-1">Runtime ${name} greets <strong>{label}</strong> at {count}</section>
  <section data-case="runtime-${name}-2">Selection {selected === 'details' ? <b>Detailed {label}</b> : <i>Summary {count}</i>}</section>
  <section data-case="runtime-${name}-3"><span>{['Mapped ', label, <em key="end">tail {count}</em>]}</span></section>
  <section data-case="runtime-${name}-4"><p children={shown ? <>Visible {label}</> : <>Hidden {count}</>} /></section>
</>; }`;
}

const sharedCases = indices.map((index) => `shared-${index}`);
const sharedFiles = {
  'src/Suite.tsx': `${props}
import { Shared } from './shared';
import { ClientLeaf } from './client-leaf';
export function Suite(props: Props) { return <main>
  ${indices.map((index) => (index % 2 ? `<Shared {...props} id="shared-${index}" variant={${index}} />` : `<ClientLeaf {...props} id="shared-${index}" variant={${index}} />`)).join('\n')}
</main>; }`,
  'src/shared.tsx': `import { Fragment, type ReactNode } from 'react';
import { T, Var, Branch, Derive } from 'gt-next';
${props}
type SharedProps = Props & { id: string; variant: number };
function Frame({ title, children }: { title: ReactNode; children: ReactNode }) { return <article><header>{title}</header>{children}</article>; }
export function Shared({ id, variant, count, selected, shown, label }: SharedProps) {
  const entries = [{ id: 'first', value: label }, { id: 'last', value: String(count) }];
  return <section data-case={id}><Frame title={<h2>Shared heading {variant}: {label}</h2>}>
    <p>Shared row {count} in {selected} <Var>{label}</Var></p>
    <ul>{entries.map(entry => <li key={entry.id}>Entry <b>{entry.value}</b></li>)}</ul>
    <p>{shown && <em>Shown {label}</em>}{!shown && <strong>Hidden {count}</strong>}</p>
    <p><Branch branch={selected} summary={<span>Summary {count}</span>} details={<span>Details {label}</span>} /></p>
    <T id={'shared-manual-' + id}>Manual boundary <Var>{label}</Var></T>
    <p>Derived <Derive>{label}</Derive> count {count}</p>
    <Fragment><small>Footer {variant}</small></Fragment>
  </Frame></section>;
}`,
  'src/client-leaf.tsx': `'use client';
import { memo, useMemo } from 'react';
import { Shared } from './shared';
${props}
type ClientProps = Props & { id: string; variant: number };
const MemoShared = memo(Shared);
export function ClientLeaf(props: ClientProps) {
  const forwarded = useMemo(() => ({ ...props, label: props.label + ' client' }), [props.count, props.selected, props.shown, props.label, props.id, props.variant]);
  return <MemoShared {...forwarded} />;
}`,
};

const generatedCases = indices.map((index) => `generated-${index}`);
const generatedSource = `${props}
export function Generated({ count, selected, shown, label }: Props) { return <main>
${indices
  .map(
    (index) => `<section data-case="generated-${index}">
  <h2>Generated section ${index} for {label}</h2>
  <p>Values {count} and {selected}<strong>{shown ? ' Visible' : ' Hidden'}</strong></p>
  <ul>{[label, selected].map((value, item) => <li key={item}>Generated item {item}: {value}</li>)}</ul>
  <p>{count > ${index % 3} ? <b>Above ${index % 3}: {count}</b> : <i>At threshold {label}</i>}</p>
</section>`
  )
  .join('\n')}
</main>; }`;
const generatedFiles = {
  'src/Suite.tsx': `'use client';
${props}
import { Generated } from './generated.raw';
export function Suite(props: Props) { return <Generated {...props} />; }`,
  'src/generated.raw': JSON.stringify({ source: generatedSource }),
  'loaders/generated.cjs': `module.exports = function generatedFixture(source) {
  const input = JSON.parse(source);
  const ts = require('typescript');
  const compiled = ts.transpileModule(input.source, { compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, verbatimModuleSyntax: true } });
  this.callback(null, compiled.outputText);
};`,
};

const barrelCases = indices.map((index) => `barrel-${index}`);
const barrelFiles = {
  'src/Suite.tsx': `${props}
import { Card, ForwardedCard } from '@parity/cards';
import { Translation, Variable, Choice, Derived, Panel } from './barrel';
export function Suite({ count, selected, shown, label }: Props) { return <main>
${indices
  .map(
    (
      index
    ) => `<${index % 2 ? 'Card' : 'ForwardedCard'} id="barrel-${index}" title={<h2>Imported card ${index}: {label}</h2>}>
  <p>Barrel content {count} for {selected}</p>
  <Panel label={label}><b>Panel text ${index} {count}</b></Panel>
  <Translation id="barrel-manual-${index}">Manual imported <Variable>{label}</Variable></Translation>
  <p><Choice branch={selected} summary={<i>Summary {count}</i>} details={<strong>Details {label}</strong>} /></p>
  <p>Derived <Derived>{label}</Derived>{shown ? ' present' : ' absent'}</p>
</${index % 2 ? 'Card' : 'ForwardedCard'}>`
  )
  .join('\n')}
</main>; }`,
  'src/barrel.ts': `export { T as Translation, Var as Variable, Branch as Choice, Derive as Derived } from 'gt-next';
export { Panel } from './panel';
export type { PanelProps } from './panel';`,
  'src/panel.tsx': `import type { ReactNode } from 'react';
export type PanelProps = { label: string; children: ReactNode };
export function Panel({ label, children }: PanelProps) { return <aside><h3>Panel for {label}</h3>{children}</aside>; }`,
  'node_modules/@parity/cards/package.json': JSON.stringify({
    name: '@parity/cards',
    version: '0.0.0',
    type: 'module',
    exports: './index.jsx',
  }),
  'node_modules/@parity/cards/index.jsx': `export { Card } from './card.jsx';
export { Card as ForwardedCard } from './card.jsx';`,
  'node_modules/@parity/cards/card.jsx': `export function Card({ id, title, children }) { return <section data-case={id}><header>{title}</header><div>Package card start</div>{children}<footer>Package card end</footer></section>; }`,
};

const pagesCases = indices.map((index) => `pages-${index}`);
const pagesSource = `import { Fragment } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { T, Var, Branch, Plural } from 'gt-next';
${props}
export function Suite({ count, selected, shown, label }: Props) {
  const rows = [{ id: 'a', label }, { id: 'b', label: selected }];
  return <main><Head><title>Pages fixture title</title><meta name="description" content={'State ' + selected} /></Head>
    <section data-case="pages-1"><h1>Pages greeting {label} at {count}</h1></section>
    <section data-case="pages-2"><Link href={'/?selected=' + selected}>Navigate to {selected}</Link></section>
    <section data-case="pages-3"><T id="pages-manual">Manual pages <Var>{label}</Var></T></section>
    <section data-case="pages-4"><p>{shown ? <b>Visible {label}</b> : <em>Hidden {count}</em>}</p></section>
    <section data-case="pages-5"><ul>{rows.map(row => <li key={row.id}>Row {row.label}</li>)}</ul></section>
    <section data-case="pages-6"><p><Branch branch={selected} summary={<span>Summary {count}</span>} details={<span>Details {label}</span>} /></p></section>
    <section data-case="pages-7"><p><Plural n={count} zero="No pages" one="One page" other={<strong>Several pages {count}</strong>} /></p></section>
    <section data-case="pages-8"><button type="button" aria-label={'Open ' + label}>Open {label}<span> ({count})</span></button></section>
    <section data-case="pages-9"><label>Name for {label}<input readOnly value={label} /></label></section>
    <section data-case="pages-10"><p>{['Leading ', label, <b key="count">Count {count}</b>]}</p></section>
    <section data-case="pages-11"><p>{count === 0 && <i>Zero entries</i>}{count !== 0 && <strong>Some entries {count}</strong>}</p></section>
    <section data-case="pages-12"><details open={shown}><summary>Disclosure {label}</summary><p>Details for {selected}</p></details></section>
    <section data-case="pages-13"><figure><figcaption>Caption for {label}</figcaption><blockquote>Quoted count {count}</blockquote></figure></section>
    <section data-case="pages-14"><div>{rows.map((row, index) => <Fragment key={row.id}><b>Index {index}</b><small>{row.label}</small></Fragment>)}</div></section>
    <section data-case="pages-15"><p children={<>Explicit children {label}<em> count {count}</em></>} /></section>
    <section data-case="pages-16"><nav><a href="#pages-end">Jump to {label}</a></nav><p id="pages-end">End of {selected} pages</p></section>
  </main>;
}`;

export const apps: ParityApp[] = [
  {
    name: '15-styled-jsx',
    description:
      'Static, dynamic, scoped and global styled-jsx CSS interleaved with translated client content.',
    files: {
      'src/Suite.tsx': styledSource,
      'src/Registry.tsx': `'use client';
import { useState, type ReactNode } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleRegistry, createStyleRegistry } from 'styled-jsx';
export function FixtureRegistry({ children }: { children: ReactNode }) {
  const [registry] = useState(() => createStyleRegistry());
  useServerInsertedHTML(() => {
    const styles = registry.styles();
    registry.flush();
    return <>{styles}</>;
  });
  return <StyleRegistry registry={registry}>{children}</StyleRegistry>;
}`,
    },
    layoutWrapper: './src/Registry',
    expected: (state) => ({
      styles: [
        {
          selector: '[data-case="styled-1"] .copy',
          property: 'color',
          value: 'rgb(17, 34, 51)',
        },
        {
          selector: '[data-case="styled-2"] .copy',
          property: 'padding-left',
          value: state.count + 'px',
        },
        {
          selector: '[data-case="styled-7"] .copy',
          property: 'color',
          value: state.shown ? 'rgb(10, 30, 50)' : 'rgb(50, 30, 10)',
        },
        {
          selector: '[data-case="styled-13"]',
          property: 'border-radius',
          value: '2px',
        },
      ],
    }),
    cases: styledCases,
  },
  {
    name: '16-runtime-pragmas',
    description:
      'A project-configured package runtime, explicit React, classic and local custom runtime modules with identical text shapes.',
    jsxImportSource: '@parity/runtime',
    files: runtimeFiles,
    cases: runtimeCases,
    expected: () => ({
      styles: runtimeProfiles.map(({ name }) => ({
        selector: `[data-case="runtime-${name}-1"]`,
        property: 'text-indent',
        value: name === 'default' ? '1px' : '0px',
      })),
    }),
  },
  {
    name: '17-shared-modules',
    description:
      'Shared JSX compiled through server and client imports, memoized leaves, manual boundaries and render props.',
    files: sharedFiles,
    cases: sharedCases,
  },
  {
    name: '18-loader-generated',
    description:
      'A user loader creates typed JSX from a non-JavaScript resource before each Next compilation stage.',
    files: generatedFiles,
    cases: generatedCases,
    nextConfig: `({
      turbopack: { rules: { '*.raw': { loaders: [require('node:path').join(__dirname, 'loaders/generated.cjs')], as: '*.tsx' } } },
      webpack(config, { defaultLoaders }) {
        config.module.rules.push({ test: /\\.raw$/, use: [defaultLoaders.babel, require('node:path').join(__dirname, 'loaders/generated.cjs')] });
        return config;
      },
    })`,
  },
  {
    name: '19-barrel-exports',
    description:
      'Local GT re-export aliases and JSX-bearing package barrels compiled through transpilePackages.',
    files: barrelFiles,
    cases: barrelCases,
    nextConfig: `({ transpilePackages: ['@parity/cards'] })`,
  },
  {
    name: '20-pages-router',
    description:
      'Pages Router providers, head metadata, links, lists, form content, conditional regions and manual GT components.',
    files: { 'src/Suite.tsx': pagesSource },
    cases: pagesCases,
    router: 'pages',
    expected: () => ({ title: 'Pages fixture title' }),
  },
];
