import type { ParityApp } from '../types';

export const apps: ParityApp[] = [
  {
    name: '08-gt-manual-boundaries',
    description:
      'Manual T and variable boundaries mixed with automatic siblings, aliases, attributes and nested expression regions.',
    files: {
      'src/Suite.tsx': `import { T, Var, Num, Currency, DateTime, T as Translate, Var as Value } from 'gt-next';
type State = { count: number; selected: string; shown: boolean; label: string };
function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) { return <div><header>{title}</header><div>{children}</div></div>; }
export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="manual-static"><T>Manual welcome</T></section>
    <section data-case="manual-variable"><T>Hello <Var>{label}</Var></T></section>
    <section data-case="manual-alias"><Translate>Account <Value>{label}</Value> is ready</Translate></section>
    <section data-case="manual-inline-markup"><T>Read <strong>important details</strong> today</T></section>
    <section data-case="manual-adjacent-auto"><T>Manual label</T><p>Automatic greeting {label}</p></section>
    <section data-case="manual-surrounded">Before <T>Manual center</T> after {label}</section>
    <section data-case="manual-var-expression"><T>Status <Var>{shown ? label : 'hidden'}</Var></T></section>
    <section data-case="manual-number"><T>Total <Num>{count}</Num> items</T></section>
    <section data-case="manual-currency"><T>Balance <Currency currency="USD">{count * 12.5}</Currency></T></section>
    <section data-case="manual-date"><T>Recorded <DateTime options={{ timeZone: 'UTC' }}>{new Date('2024-01-02T12:00:00Z')}</DateTime></T></section>
    <section data-case="manual-var-subtree"><Var><span>Variable subtree {label}<i>{selected}</i></span></Var></section>
    <section data-case="manual-var-conditional"><Var>{shown ? <b>Visible subtree {label}</b> : <i>Hidden subtree {label}</i>}</Var></section>
    <section data-case="manual-var-attribute"><Var><Card title={<b>Variable title {label}</b>}>Variable body {selected}</Card></Var></section>
    <section data-case="manual-t-conditional"><T>Choice <Var>{shown ? <strong>Visible heading</strong> : <em>Hidden heading</em>}</Var></T></section>
    <section data-case="manual-t-slot"><T><Card title={<b>Card heading <Var>{label}</Var></b>}>Card content</Card></T></section>
    <section data-case="manual-keyed"><T key={selected}>Selected <Var>{selected}</Var></T></section>
    <section data-case="manual-var-array"><T>Members <Var>{[label, ' / ', selected]}</Var></T></section>
    <section data-case="manual-typed"><T>Typed <Var>{label as string}</Var><Var>{count satisfies number}</Var></T></section>
  </main>;
}
`,
    },
    cases: [
      'manual-static',
      'manual-variable',
      'manual-alias',
      'manual-inline-markup',
      'manual-adjacent-auto',
      'manual-surrounded',
      'manual-var-expression',
      'manual-number',
      'manual-currency',
      'manual-date',
      'manual-var-subtree',
      'manual-var-conditional',
      'manual-var-attribute',
      'manual-t-conditional',
      'manual-t-slot',
      'manual-keyed',
      'manual-var-array',
      'manual-typed',
    ],
  },
  {
    name: '09-branch-selection',
    description:
      'Real Branch selection through content props, fallbacks, aliases, boolean and number keys, nesting and source spreads.',
    files: {
      'src/Suite.tsx': `import { Branch, Branch as Choose, T, Var } from 'gt-next';
type State = { count: number; selected: string; shown: boolean; label: string };

export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="branch-basic"><Branch branch={selected} summary="Summary screen" details="Detail screen" /></section>
    <section data-case="branch-jsx"><Branch branch={selected} summary={<p>Summary for {label}</p>} details={<aside>Details for {label}</aside>} /></section>
    <section data-case="branch-fallback"><Branch branch="absent" summary="Unused summary">Fallback for {label}</Branch></section>
    <section data-case="branch-parent">Panel <Branch branch={selected} summary="Brief" details="Expanded" /> for {label}</section>
    <section data-case="branch-alias"><Choose branch={selected} summary={<b>Alias summary {label}</b>} details={<i>Alias details {count}</i>} /></section>
    <section data-case="branch-boolean"><Branch branch={shown} {...{ true: <b>Shown {label}</b>, false: <i>Hidden {label}</i> }} /></section>
    <section data-case="branch-number"><Branch branch={count} {...{ 0: 'No entries', 1: 'Single entry', 3: 'Three entries' }} /></section>
    <section data-case="branch-empty-name"><Branch branch="" {...{ '': 'Empty branch' }}>Empty key fallback</Branch></section>
    <section data-case="branch-data-prefix"><Branch branch="data-secret" data-secret="Reserved metadata">Reserved key fallback</Branch></section>
    <section data-case="branch-nested"><Branch branch={selected} summary={<Branch branch={shown} {...{ true: 'Nested shown', false: 'Nested hidden' }} />} details={<span>Nested details {label}</span>} /></section>
    <section data-case="branch-manual"><T>Choice <Branch branch={selected} summary={<b>Summary <Var>{label}</Var></b>} details={<i>Details <Var>{label}</Var></i>} /></T></section>
    <section data-case="branch-array-prop"><Branch branch={selected} summary={['Summary ', label]} details={['Detail ', count]} /></section>
    <section data-case="branch-dynamic-prop"><Branch branch={selected} summary={label} details={selected.toUpperCase()} /></section>
    <section data-case="branch-prop-spread"><Branch {...{ branch: selected, summary: <p>Spread summary {label}</p>, details: <p>Spread detail {count}</p> }} /></section>
    <section data-case="branch-control-spread"><Branch {...{ branch: 'summary' }} branch={selected} summary="Chosen summary" details="Chosen details" /></section>
    <section data-case="branch-null-option"><Branch branch={selected} summary={null} details={<span>Present detail {label}</span>}>Default only when undefined</Branch></section>
    <section data-case="branch-undefined-option"><Branch branch={selected} summary={undefined} details={<span>Defined detail {label}</span>}>Undefined option fallback</Branch></section>
    <section data-case="branch-key"><Branch key={selected} branch={selected} summary={<span>Keyed summary {label}</span>} details={<span>Keyed details {label}</span>} /></section>
  </main>;
}
`,
    },
    cases: [
      'branch-basic',
      'branch-jsx',
      'branch-fallback',
      'branch-parent',
      'branch-alias',
      'branch-boolean',
      'branch-number',
      'branch-empty-name',
      'branch-data-prefix',
      'branch-nested',
      'branch-manual',
      'branch-array-prop',
      'branch-dynamic-prop',
      'branch-prop-spread',
      'branch-control-spread',
      'branch-null-option',
      'branch-undefined-option',
      'branch-key',
    ],
  },
  {
    name: '10-plural-selection',
    description:
      'Plural category and legacy-name selection with JSX, nested branches, literal and computed props, fallback and formatted numbers.',
    files: {
      'src/Suite.tsx': `import { Plural, Plural as Quantity, Branch, T, Var, Num } from 'gt-next';
type State = { count: number; selected: string; shown: boolean; label: string };

export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="plural-basic"><Plural n={count} one="One message" other="Many messages" /></section>
    <section data-case="plural-legacy-names"><Plural n={count} singular="Legacy singular" plural="Legacy plural" dual="Legacy dual" other="Legacy other" /></section>
    <section data-case="plural-jsx"><Plural n={count} one={<b>One for {label}</b>} other={<i>Many for {label}</i>} /></section>
    <section data-case="plural-parent">Inbox <Plural n={count} one="message" other="messages" /> for {label}</section>
    <section data-case="plural-alias"><Quantity n={count} one={<span>Alias item {label}</span>} other={<span>Alias items {count}</span>} /></section>
    <section data-case="plural-zero"><Plural n={count} zero="Zero category" one="Single category" other="Other category" /></section>
    <section data-case="plural-negative"><Plural n={-count} one="Negative single" other="Negative other" /></section>
    <section data-case="plural-fraction"><Plural n={count + 0.5} one="Fraction single" other="Fraction other" /></section>
    <section data-case="plural-fallback"><Plural n={count}>Default plural body {label}</Plural></section>
    <section data-case="plural-locale"><Plural n={count} locales={['en-US']} one="Localized one" other="Localized many" /></section>
    <section data-case="plural-array"><Plural n={count} one={['One ', label]} other={['Several ', count, ' ', label]} /></section>
    <section data-case="plural-dynamic"><Plural n={count} one={label} other={selected.toUpperCase()} /></section>
    <section data-case="plural-spread"><Plural {...{ n: count, one: <span>Spread one {label}</span>, other: <span>Spread many {label}</span> }} /></section>
    <section data-case="plural-nested-branch"><Plural n={count} one={<Branch branch={selected} summary="One summary" details="One detail" />} other={<Branch branch={selected} summary="Many summaries" details="Many details" />} /></section>
    <section data-case="plural-nested-plural"><Plural n={count} one={<Plural n={count + 1} one="Nested one" other="Nested other" />} other={<span>Outer many {label}</span>} /></section>
    <section data-case="plural-manual"><T>Total <Num>{count}</Num>: <Plural n={count} one={<b>One <Var>{label}</Var></b>} other={<i>Many <Var>{label}</Var></i>} /></T></section>
    <section data-case="plural-key"><Plural key={selected} n={count} one="Keyed one" other="Keyed many" /></section>
    <section data-case="plural-null"><Plural n={count} one={null} other={<span>Non-null many {label}</span>}>Null category fallback</Plural></section>
  </main>;
}
`,
    },
    cases: [
      'plural-basic',
      'plural-legacy-names',
      'plural-jsx',
      'plural-parent',
      'plural-alias',
      'plural-zero',
      'plural-negative',
      'plural-fraction',
      'plural-fallback',
      'plural-locale',
      'plural-array',
      'plural-dynamic',
      'plural-spread',
      'plural-nested-branch',
      'plural-nested-plural',
      'plural-manual',
      'plural-key',
      'plural-null',
    ],
  },
  {
    name: '11-derive-boundaries',
    description:
      'Derive ownership through direct JSX, dynamic expressions, arrays, manual translations, opaque ancestors and component slots.',
    files: {
      'src/Suite.tsx': `import { Derive, Derive as Derived, Branch, Plural, T, Var } from 'gt-next';
type State = { count: number; selected: string; shown: boolean; label: string };
function Slot({ title, children }: { title: React.ReactNode; children: React.ReactNode }) { return <article><header>{title}</header><div>{children}</div></article>; }
export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="derive-literal"><Derive>Derived literal</Derive></section>
    <section data-case="derive-dynamic"><Derive>{label}</Derive></section>
    <section data-case="derive-parent">Hello <Derive>{label}</Derive> today</section>
    <section data-case="derive-jsx"><Derive><p>Derived paragraph {label}</p></Derive></section>
    <section data-case="derive-nested"><Derive><Derive><b>Twice derived {label}</b></Derive></Derive></section>
    <section data-case="derive-alias"><Derived><span>Alias derived {selected}</span></Derived></section>
    <section data-case="derive-conditional"><Derive>{shown ? <b>Shown derive {label}</b> : <i>Hidden derive {label}</i>}</Derive></section>
    <section data-case="derive-logical"><Derive>{shown && <span>Logical derive {label}</span>}</Derive></section>
    <section data-case="derive-array"><Derive>{['Derived array ', label, count]}</Derive></section>
    <section data-case="derive-mapped"><Derive>{[label, selected].map((value, index) => <span key={index}>Mapped derive {value}</span>)}</Derive></section>
    <section data-case="derive-children-prop"><Derive children={<p>Children prop derive {label}</p>} /></section>
    <section data-case="derive-spread-children"><Derive {...{ children: <p>Spread derive {label}</p> }} /></section>
    <section data-case="derive-manual"><T>Manual derive <Derive><b>Nested static</b></Derive><Var>{label}</Var></T></section>
    <section data-case="derive-inside-var"><Var><Derive><span>Suppressed derive {label}</span></Derive></Var></section>
    <section data-case="derive-branch"><Branch branch={selected} summary={<Derive><span>Summary derive {label}</span></Derive>} details={<Derive><b>Detail derive {count}</b></Derive>} /></section>
    <section data-case="derive-plural"><Plural n={count} one={<Derive><i>Single derive {label}</i></Derive>} other={<Derive><strong>Several derive {label}</strong></Derive>} /></section>
    <section data-case="derive-fragment"><Derive><>Fragment derive <b>{label}</b><em>{selected}</em></></Derive></section>
    <section data-case="derive-slot"><Derive><Slot title={<b>Derived title {label}</b>}>Derived slot {selected}</Slot></Derive></section>
  </main>;
}
`,
    },
    cases: [
      'derive-literal',
      'derive-dynamic',
      'derive-parent',
      'derive-jsx',
      'derive-nested',
      'derive-alias',
      'derive-conditional',
      'derive-logical',
      'derive-array',
      'derive-mapped',
      'derive-children-prop',
      'derive-spread-children',
      'derive-manual',
      'derive-inside-var',
      'derive-branch',
      'derive-plural',
      'derive-fragment',
      'derive-slot',
    ],
  },
  {
    name: '12-control-flow',
    description:
      'Real control-flow evaluation across callback bodies, loops, switches, expression containers, nested arrays and typed expression erasure.',
    files: {
      'src/Suite.tsx': `import { Fragment } from 'react';
type State = { count: number; selected: string; shown: boolean; label: string };
function Invoke({ render }: { render: () => React.ReactNode }) { return <div>{render()}</div>; }
export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="flow-conditional">Status {shown ? <b>Shown {label}</b> : <i>Hidden {label}</i>}</section>
    <section data-case="flow-logical">Visible {shown && <b>Current {label}</b>}</section>
    <section data-case="flow-logical-or">Fallback {shown || <i>Hidden fallback {label}</i>}</section>
    <section data-case="flow-nullish">Nullish {(shown ? null : <b>Selected {label}</b>) ?? <i>Default {selected}</i>}</section>
    <section data-case="flow-map">Mapped {[label, selected].map((value, index) => <b key={index}>Value {value}</b>)}</section>
    <section data-case="flow-filter">Filtered {[label, '', selected].filter(Boolean).map((value, index) => <span key={index}>Kept {value}</span>)}</section>
    <section data-case="flow-flatmap">Flat {[label, selected].flatMap((value, index) => [<b key={index}>Pair {value}</b>, ' / '])}</section>
    <section data-case="flow-reduce">Reduced {[label, selected].reduce<React.ReactNode[]>((items, value, index) => [...items, <i key={index}>Reduced {value}</i>], [])}</section>
    <section data-case="flow-iife">IIFE {(() => { const local = label.toUpperCase(); return <span>Local {local}</span>; })()}</section>
    <section data-case="flow-switch">Switch {(() => { switch (selected) { case 'details': return <b>Detailed {label}</b>; default: return <i>Summary {label}</i>; } })()}</section>
    <section data-case="flow-loop">Loop {(() => { const nodes: React.ReactNode[] = []; for (const [index, value] of [label, selected].entries()) nodes.push(<b key={index}>Loop item {value}</b>); return nodes; })()}</section>
    <section data-case="flow-try-finally">Guard {(() => { try { if (!shown) return <i>Early {label}</i>; return <b>Normal {selected}</b>; } finally { void count; } })()}</section>
    <section data-case="flow-nested-array">Nested {[[<b key="label">Label {label}</b>], [<i key="selected">Selected {selected}</i>]]}</section>
    <section data-case="flow-sparse-array">Sparse {['Start ', , <b key="value">Sparse {label}</b>, null, false]}</section>
    <section data-case="flow-spread-array">Spread {['Start ', ...[<b key="value">Expanded {label}</b>], ' End']}</section>
    <section data-case="flow-typed">Typed {((shown ? <b>Typed visible {label}</b> : <i>Typed hidden {label}</i>) satisfies React.ReactNode)}</section>
    <section data-case="flow-function-child"><Invoke render={() => <span>Callback {label}</span>} /></section>
    <section data-case="flow-keyed-fragment">Groups {[label, selected].map((value, index) => <Fragment key={index}><b>Group {value}</b><i>{count}</i></Fragment>)}</section>
  </main>;
}
`,
    },
    cases: [
      'flow-conditional',
      'flow-logical',
      'flow-logical-or',
      'flow-nullish',
      'flow-map',
      'flow-filter',
      'flow-flatmap',
      'flow-reduce',
      'flow-iife',
      'flow-switch',
      'flow-loop',
      'flow-try-finally',
      'flow-nested-array',
      'flow-sparse-array',
      'flow-spread-array',
      'flow-typed',
      'flow-function-child',
      'flow-keyed-fragment',
    ],
  },
  {
    name: '13-component-slots',
    description:
      'Custom component children, render props, member names, spread ownership and manual/opaque components in independently rendered slots.',
    files: {
      'src/Suite.tsx': `import { Branch, Plural, Derive, T, Var } from 'gt-next';
import { createElement, Fragment } from 'react';
type State = { count: number; selected: string; shown: boolean; label: string };
function Card({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) { return <article><header>{title}</header><div>{children}</div></article>; }
function RenderCard({ render, children }: { render: () => React.ReactNode; children: React.ReactNode }) { return <article><header>{render()}</header><div>{children}</div></article>; }
function FunctionSlot({ children }: { children: () => React.ReactNode }) { return <div>{children()}</div>; }
const UI = { Card };
const ui = { Card };
export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="slot-basic"><Card title={<b>Title {label}</b>}>Body {selected}</Card></section>
    <section data-case="slot-empty-body"><Card title={<b>Only title {label}</b>} /></section>
    <section data-case="slot-string-prop"><Card title="Literal title">String title body {label}</Card></section>
    <section data-case="slot-array-prop"><Card title={['Array title ', label]}>Array title body {count}</Card></section>
    <section data-case="slot-conditional-prop"><Card title={shown ? <b>Shown title {label}</b> : <i>Hidden title {label}</i>}>Conditional body</Card></section>
    <section data-case="slot-render-prop"><RenderCard render={() => <b>Rendered header {label}</b>}>Render body {selected}</RenderCard></section>
    <section data-case="slot-children-function"><FunctionSlot>{() => <p>Function children {label}</p>}</FunctionSlot></section>
    <section data-case="slot-member-tag"><UI.Card title={<b>Member title {label}</b>}>Member body {count}</UI.Card></section>
    <section data-case="slot-lowercase-member"><ui.Card title={<b>Lower member title {label}</b>}>Lower member body {selected}</ui.Card></section>
    <section data-case="slot-spread"><Card {...{ title: <b>Spread title {label}</b>, children: <span>Spread body {selected}</span> }} /></section>
    <section data-case="slot-spread-child-override"><Card {...{ title: <b>Overridden title {label}</b>, children: 'Earlier child' }}>Final child {label}</Card></section>
    <section data-case="slot-children-attribute"><Card title={<b>Attribute title {label}</b>} children={<p>Attribute body {count}</p>} /></section>
    <section data-case="slot-manual"><Card title={<T>Manual title <Var>{label}</Var></T>}>Automatic card body {count}</Card></section>
    <section data-case="slot-branch"><Card title={<Branch branch={selected} summary="Summary heading" details="Detail heading" />}>Branch slot body {label}</Card></section>
    <section data-case="slot-plural"><Card title={<Plural n={count} one="Single heading" other="Many headings" />}>Plural slot body {label}</Card></section>
    <section data-case="slot-derive"><Card title={<Derive><b>Derived heading {label}</b></Derive>}>Derive slot body {selected}</Card></section>
    <section data-case="slot-create-element">Factory {createElement(Card, { title: <b>Factory heading {label}</b> }, <span>Factory body {selected}</span>)}</section>
    <section data-case="slot-fragment"><Card title={<Fragment><b>First heading {label}</b><i>Second heading {selected}</i></Fragment>}>Fragment slot {count}</Card></section>
  </main>;
}
`,
    },
    cases: [
      'slot-basic',
      'slot-empty-body',
      'slot-string-prop',
      'slot-array-prop',
      'slot-conditional-prop',
      'slot-render-prop',
      'slot-children-function',
      'slot-member-tag',
      'slot-lowercase-member',
      'slot-spread',
      'slot-spread-child-override',
      'slot-children-attribute',
      'slot-manual',
      'slot-branch',
      'slot-plural',
      'slot-derive',
      'slot-create-element',
      'slot-fragment',
    ],
  },
  {
    name: '14-keys-identity',
    expectedConsoleErrors: ['spread-key'],
    description:
      'Element key ownership and remount observations, helper identity, static child-array freezing and arrays with holes/spreads.',
    files: {
      'src/Suite.tsx': `import { Fragment, createElement, cloneElement, isValidElement } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { jsxDEV } from 'react/jsx-dev-runtime';
import { Token } from './Token';
type State = { count: number; selected: string; shown: boolean; label: string };
function ReadKey({ children }: { children: React.ReactNode }) { return <output>{isValidElement(children) ? String(children.key) : 'not-an-element'}</output>; }
function Inspect({ children }: { children: React.ReactNode }) {
  const child = isValidElement<{ children?: React.ReactNode }>(children) ? children.props.children : undefined;
  const nested = isValidElement<{ children?: React.ReactNode }>(child) ? child.props.children : child;
  return <output>{JSON.stringify({ array: Array.isArray(nested), frozen: Object.isFrozen(nested), length: Array.isArray(nested) ? nested.length : null, holeAtOne: Array.isArray(nested) ? !(1 in nested) : false })}</output>;
}
export function Suite({ count, selected, shown, label }: State) {
  return <main>
    <section data-case="keys-fixed"><Token key="fixed" value={label} /></section>
    <section data-case="keys-changing"><Token key={selected} value={label} /></section>
    <section data-case="keys-stable-list">Stable {(shown ? ['alpha', 'beta'] : ['beta', 'alpha']).map((value) => <Token key={value} value={value + ':' + label} />)}</section>
    <section data-case="keys-index-list">Index {(shown ? ['alpha', 'beta'] : ['beta', 'alpha']).map((value, index) => <Token key={index} value={value + ':' + label} />)}</section>
    <section data-case="keys-fragment"><Fragment key={selected}><Token value={label} /><span>Fragment {selected}</span></Fragment></section>
    <section data-case="keys-explicit-before-spread"><Token key={selected} {...{ value: label }} /></section>
    <section data-case="keys-explicit-after-spread"><Token {...{ value: label }} key={selected} /></section>
    <section data-case="keys-spread-key"><Token {...{ key: selected, value: label }} /></section>
    <section data-case="keys-clone"><ReadKey>{cloneElement(<span key="original">Cloned label {label}</span>, { key: selected })}</ReadKey></section>
    <section data-case="keys-number"><ReadKey><span key={count}>Numeric key {label}</span></ReadKey></section>
    <section data-case="keys-null"><ReadKey><span key={null}>Null key {label}</span></ReadKey></section>
    <section data-case="keys-factory"><ReadKey>{createElement('span', { key: selected }, 'Factory ' + label)}</ReadKey></section>
    <section data-case="identity-helpers"><output>{JSON.stringify({ jsxIsJsxs: jsx === jsxs, jsxIsDev: jsx === jsxDEV, singleArity: jsx.length, multipleArity: jsxs.length })}</output></section>
    <section data-case="array-explicit-freeze"><Inspect><div>{['Array ', label]}</div></Inspect></section>
    <section data-case="array-static-freeze"><Inspect><div>Static array {label}</div></Inspect></section>
    <section data-case="array-sparse-freeze"><Inspect><div>{['Sparse ', , label]}</div></Inspect></section>
    <section data-case="array-spread-freeze"><Inspect><div>{['Spread ', ...[label]]}</div></Inspect></section>
    <section data-case="array-nested-freeze"><Inspect><div>{['Nested ', [label, selected]]}</div></Inspect></section>
  </main>;
}
`,
      'src/Token.tsx': `'use client';
import { useState } from 'react';
export function Token({ value }: { value: string }) {
  const [initial] = useState(value);
  return <output>{JSON.stringify({ initial, value })}</output>;
}
`,
    },
    cases: [
      'keys-fixed',
      'keys-changing',
      'keys-stable-list',
      'keys-index-list',
      'keys-fragment',
      'keys-explicit-before-spread',
      'keys-explicit-after-spread',
      'keys-spread-key',
      'keys-clone',
      'keys-number',
      'keys-null',
      'keys-factory',
      'identity-helpers',
      'array-explicit-freeze',
      'array-static-freeze',
      'array-sparse-freeze',
      'array-spread-freeze',
      'array-nested-freeze',
    ],
  },
];
