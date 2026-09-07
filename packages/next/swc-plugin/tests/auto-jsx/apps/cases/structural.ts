import type { ParityApp } from '../types';

type RenderCase = readonly [name: string, expression: string];

function app(
  name: string,
  description: string,
  cases: readonly RenderCase[],
  imports = '',
  declarations = '',
  helpers: Record<string, string> = {}
): ParityApp {
  return {
    name,
    description,
    cases: cases.map(([id]) => id),
    files: {
      'src/Suite.tsx': `${name === '06-binding-shadows' ? "'use client';" : ''}
import { Fragment, isValidElement${name === '06-binding-shadows' ? ', Component' : ''} } from 'react';
import type { ReactNode } from 'react';
${imports}
type State = { count: number; selected: string; shown: boolean; label: string };
function Echo({ children }: { children?: ReactNode }) { return <>{children}</>; }
function Slot({ header, children }: { header?: ReactNode; children?: ReactNode }) {
  return <article><header>{header}</header><div>{children}</div></article>;
}
${declarations}
export function Suite({ count, selected, shown, label }: State) {
  return <div data-suite=${JSON.stringify(name)}>
${cases.map(([id, expression]) => `    <section data-case=${JSON.stringify(id)}>${expression}</section>`).join('\n')}
  </div>;
}
`,
      ...helpers,
    },
  };
}

const literalCases: RenderCase[] = [
  ['plain-text', '<p>Hello, world.</p>'],
  ['adjacent-dynamics', '<p>Welcome {label}{count}!</p>'],
  [
    'multiline-text',
    '<p>First line\n      second line\n      third line {label}</p>',
  ],
  [
    'entities',
    '<p>Fish &amp; chips &lt;fresh&gt; &quot;today&quot; {label}</p>',
  ],
  ['nbsp-boundary', '<p>Amount&nbsp;{count}\u00a0items</p>'],
  ['quoted-children', '<p children="Quoted content" />'],
  ['string-expression', '<p>{"A string expression"}</p>'],
  ['static-template', '<p>{`A static template`}</p>'],
  ['dynamic-template', '<p>Greeting: {`Hello ${label}`}</p>'],
  ['numeric-literals', '<p>Numbers: {0}{-1}{3.5}{count}</p>'],
  ['null-and-booleans', '<p>Visible{null}{false}{true}{shown && label}</p>'],
  ['preserved-spaces', '<p><b>First</b>{" "}<i>Second</i>{" "}{label}</p>'],
  ['unicode-text', '<p>日本語 العربية café e\u0301 👩🏽‍💻 {label}</p>'],
  ['whitespace-only', '<p>{" \t\u00a0\u2003"}</p>'],
  ['line-breaks', '<p>Start<br />Middle<wbr />End {label}</p>'],
  [
    'comments-between-children',
    '<p>Hello{/* separate children */}{label}{/* trailing */}!</p>',
  ],
];

const ownershipCases: RenderCase[] = [
  [
    'parent-claims-child',
    '<div>Heading <strong>Inside {label}</strong> tail {count}</div>',
  ],
  ['independent-siblings', '<div><p>One {label}</p><p>Two {count}</p></div>'],
  ['fragment-claim', '<>Fragment {label}<b>Nested {count}</b></>'],
  ['nested-fragments', '<div><><><p>Deep {label}</p></></></div>'],
  [
    'conditional-child',
    '<p>Status: {shown ? <b>Shown {label}</b> : <i>Hidden {count}</i>}</p>',
  ],
  [
    'conditional-root',
    '{shown ? <p>Ready {label}</p> : <p>Waiting {count}</p>}',
  ],
  ['logical-child', '<p>Availability {shown && <b>Available {label}</b>}</p>'],
  [
    'nullish-child',
    '<p>Selection {(shown ? null : label) ?? <b>Fallback {count}</b>}</p>',
  ],
  [
    'component-slots',
    '<Slot header={<b>Header {label}</b>}>Body {count}</Slot>',
  ],
  ['render-callback', '<Echo>{(() => <p>Callback {label}</p>)()}</Echo>'],
  [
    'mapped-regions',
    '<div>{[1, 2, 3].map(value => <p key={value}>Row {value}: {label}</p>)}</div>',
  ],
  ['manual-translation', '<T>Manual <Var>{label}</Var></T>'],
  [
    'manual-under-auto',
    '<p>Automatic <T>Manual <Var>{label}</Var></T> tail {count}</p>',
  ],
  [
    'manual-conditional',
    '<T>{shown ? <b>Conditional manual {label}</b> : <i>Empty state {count}</i>}</T>',
  ],
  [
    'variable-boundary',
    '<p>Variable <Var><b>Untranslated subtree {label}</b></Var> after</p>',
  ],
  [
    'react-fragment-component',
    '<Fragment>Named fragment {label}<Fragment><i>Inner {count}</i></Fragment></Fragment>',
  ],
];

const arrayCases: RenderCase[] = [
  ['literal-array', '<p>{["Hello", label, count]}</p>'],
  ['nested-arrays', '<p>{["Outer", ["Inner", label], count]}</p>'],
  [
    'array-with-jsx',
    '<p>{["Before", <b key="bold">Middle {label}</b>, count]}</p>',
  ],
  ['array-as-one-of-many', '<p>Prefix {["One", label]} suffix {count}</p>'],
  ['sparse-array', '<p>{["First", , label, , "Last"]}</p>'],
  ['spread-array', '<p>{["Start", ...[label, count], "End"]}</p>'],
  [
    'jsx-only-array',
    '<div>{[<p key="first">First {label}</p>, <p key="last">Last {count}</p>]}</div>',
  ],
  [
    'variable-array',
    '{(() => { const values = ["A", label, count]; return <p>{values}</p>; })()}',
  ],
  [
    'mapped-array',
    '<p>{[1, 2, 3].map(value => <span key={value}>Item {value}: {label}</span>)}</p>',
  ],
  [
    'flatmap-array',
    '<p>{[1, 2].flatMap(value => [<b key={value}>Part {value}</b>, label])}</p>',
  ],
  [
    'filter-array',
    '<p>{["Always", shown ? label : null, count || null].filter(Boolean)}</p>',
  ],
  [
    'conditional-array',
    '<p>{shown ? ["Visible", label] : ["Hidden", count]}</p>',
  ],
  [
    'readonly-tuple',
    '{(() => { const values = ["Readonly", label, count] as const; return <p>{values}</p>; })()}',
  ],
  [
    'frozen-source-array',
    '{(() => { const values = Object.freeze(["Frozen", label]); return <p>{values}<output>{String(Object.isFrozen(values))}</output></p>; })()}',
  ],
  [
    'static-array-freezing',
    '{(() => { const node = <p>{["Literal array", label]}</p>; return <>{node}<output>{String(firstArrayIsFrozen(node))}</output></>; })()}',
  ],
  [
    'multi-child-freezing',
    '{(() => { const node = <p>Literal siblings {label}<b>Tail</b></p>; return <>{node}<output>{String(firstArrayIsFrozen(node))}</output></>; })()}',
  ],
];

const spreadCases: RenderCase[] = [
  [
    'children-before-spread',
    '<p children="Initial" {...{ children: `Final ${label}` }} />',
  ],
  [
    'children-after-spread',
    '<p {...{ children: "Initial" }} children={label} />',
  ],
  [
    'raw-children-after-spread',
    '<p {...{ children: "Discarded" }}>Actual {label}</p>',
  ],
  [
    'inline-object-children',
    '<p {...{ children: ["Inline", label, count] }} />',
  ],
  ['quoted-property-children', '<p {...{ "children": ["Quoted", label] }} />'],
  [
    'computed-string-children',
    '<p {...{ ["children"]: ["Computed", label] }} />',
  ],
  [
    'computed-name-children',
    '{(() => { const children = "children"; return <p {...{ [children]: ["Computed name", label] }} />; })()}',
  ],
  [
    'shorthand-children',
    '{(() => { const children = <b>Shorthand {label}</b>; return <p {...{ children }} />; })()}',
  ],
  [
    'getter-order',
    '{(() => { const calls: string[] = []; const props = { get title() { calls.push("title"); return "Tooltip"; }, get children() { calls.push("children"); return `Getter ${label}`; } }; const node = <p {...props} />; return <>{node}<output>{calls.join("|")}</output></>; })()}',
  ],
  [
    'overridden-getter',
    '{(() => { const calls: string[] = []; const props = { get children() { calls.push("discarded getter"); return "Discarded"; } }; const node = <p {...props}>Override {label}</p>; return <>{node}<output>{calls.join("|")}</output></>; })()}',
  ],
  [
    'multiple-spread-getters',
    '{(() => { const calls: string[] = []; const first = { get children() { calls.push("first"); return "First"; } }; const last = { get children() { calls.push("last"); return `Last ${label}`; } }; const node = <p {...first} {...last} />; return <>{node}<output>{calls.join("|")}</output></>; })()}',
  ],
  [
    'spread-key-fallback',
    '<p {...{ title: "Spread first" }} key={selected}>Classic fallback {label}</p>',
  ],
  [
    'key-before-spread',
    '<p key={selected} {...{ title: "Key first" }}>Automatic runtime {label}</p>',
  ],
  [
    'key-effect-order',
    '{(() => { const calls: string[] = []; const node = <p {...{ title: (calls.push("title"), "Tooltip") }} key={(calls.push("key"), selected)}>Keyed {label}</p>; return <>{node}<output>{calls.join("|")}</output></>; })()}',
  ],
  [
    'nonenumerable-children',
    '{(() => { const props = Object.defineProperty({ title: "Own title" }, "children", { value: "Hidden", enumerable: false }); return <p {...props}>Enumerable fallback {label}</p>; })()}',
  ],
  [
    'accessor-built-jsx',
    '{(() => { const calls: string[] = []; const props = { get children() { calls.push("read"); return <b>Accessor JSX {label}</b>; } }; const node = <p {...props} />; return <>{node}<output>{calls.join("|")}</output></>; })()}',
  ],
];

const runtimeCases: RenderCase[] = [
  ['raw-static-call', '{runtimeJsx("p", { children: "Already lowered" })}'],
  [
    'raw-dynamic-array',
    '{runtimeJsxs("p", { children: ["Lowered", label, count] })}',
  ],
  [
    'mixed-parent-region',
    '<p>Intro {runtimeJsx("b", { children: "Lowered child" })} tail</p>',
  ],
  [
    'mixed-child-region',
    '{runtimeJsx("p", { children: <b>Raw child {label}</b> })}',
  ],
  [
    'manual-call-boundary',
    '{runtimeJsx(T, { children: <b>Manual call subtree</b> })}',
  ],
  [
    'manual-call-variable',
    '{runtimeJsxs(T, { children: ["Manual", runtimeJsx(Var, { children: label })] })}',
  ],
  [
    'variable-call-boundary',
    '<p>Before {runtimeJsx(Var, { children: <b>Variable subtree {label}</b> })} after</p>',
  ],
  [
    'opaque-call',
    '{runtimeJsx(Branch, { branch: selected, summary: <b>Summary {label}</b>, details: <i>Details {count}</i> })}',
  ],
  [
    'nested-runtime-call',
    '{runtimeJsx("div", { children: runtimeJsxs("p", { children: ["Nested", label] }) })}',
  ],
  [
    'runtime-fragment',
    '{runtimeJsxs(Fragment, { children: ["Runtime fragment", <b key="b">Part {label}</b>, count] })}',
  ],
  [
    'runtime-in-conditional',
    '<p>Conditional {shown ? runtimeJsx("b", { children: "Shown call" }) : runtimeJsx("i", { children: "Hidden call" })}</p>',
  ],
  [
    'runtime-in-array',
    '<p>{["Array", runtimeJsx("b", { children: "Call in array" }, "b"), label]}</p>',
  ],
  [
    'runtime-in-callback',
    '<p>{[1, 2].map(value => runtimeJsxs("b", { children: ["Mapped call", value, label] }, value))}</p>',
  ],
  [
    'runtime-namespace',
    '<p>Namespace {Runtime.jsx("b", { children: "Namespace call" })}</p>',
  ],
  [
    'runtime-shadow',
    '{((runtimeJsx: typeof Runtime.jsx) => <p>Shadow {runtimeJsx("b", { children: "Shadowed local function" })}</p>)(Runtime.jsx)}',
  ],
  [
    'runtime-key-evaluation',
    '{(() => { const calls: string[] = []; const node = runtimeJsx("b", { children: "Keyed call" }, (calls.push("key"), selected)); return <>{node}<output>{calls.join("|")}</output></>; })()}',
  ],
];

const bindingCases: RenderCase[] = [
  ['imported-manual', '<T>Imported <Var>{label}</Var></T>'],
  ['aliased-manual', '<Text>Aliased <Var>{label}</Var></Text>'],
  [
    'unicode-manual-alias',
    '<Übersetzung>Unicode alias <Var>{label}</Var></Übersetzung>',
  ],
  [
    'arrow-parameter-shadow',
    '{((T: typeof Echo) => <T>Parameter {label}</T>)(Echo)}',
  ],
  [
    'destructured-shadow',
    '{(({ Var }: { Var: typeof Echo }) => <Var>Destructured {label}<b>Nested {count}</b></Var>)({ Var: Echo })}',
  ],
  [
    'local-const-shadow',
    '{(() => { const T = Echo; return <T>Local constant {label}</T>; })()}',
  ],
  [
    'block-shadow',
    '{(() => { const outside = <T>Outside</T>; { const T = Echo; return <>{outside}<T>Inside block {label}</T></>; } })()}',
  ],
  [
    'catch-shadow',
    '{(() => { try { throw Echo; } catch (Var) { const Local = Var as typeof Echo; return <Local>Caught {label}</Local>; } })()}',
  ],
  [
    'for-binding-shadow',
    '{(() => { const rows: ReactNode[] = []; for (const T of [Echo]) rows.push(<T key="row">Loop {label}</T>); return <>{rows}<T>Imported again</T></>; })()}',
  ],
  [
    'default-initializer-import',
    '{(() => { function render(initial: ReactNode = <T>Default imported</T>) { const T = Echo; return <>{initial}<T>Body local {label}</T></>; } return render(); })()}',
  ],
  [
    'default-initializer-parameter',
    '{(() => { function render(T = Echo, initial: ReactNode = <T>Default local {label}</T>) { return initial; } return render(); })()}',
  ],
  [
    'class-expression-name',
    '{(() => { const Local = class T extends Component { render() { return <p>Named class {label}</p>; } }; return <Local />; })()}',
  ],
  [
    'function-expression-name',
    '{(() => { const Local = function T() { return <p>Named function {label}</p>; }; return <Local />; })()}',
  ],
  [
    'nested-import-alias-shadow',
    '{((Text: typeof Echo) => <Text>Shadowed alias {label}<T>Inner imported</T></Text>)(Echo)}',
  ],
  [
    'closure-restores-binding',
    '{(() => { const render = ((T: typeof Echo) => () => <T>Closed local {label}</T>)(Echo); return <>{render()}<T>Closed imported</T></>; })()}',
  ],
  [
    'component-property',
    '{(() => { const Components = { T: Echo }; return <Components.T>Member component {label}</Components.T>; })()}',
  ],
];

const typescriptCases: RenderCase[] = [
  ['as-expression', '<p>{("Asserted" as string)} {label as string}</p>'],
  ['const-assertion', '<p>{(["Constant", label] as const)}</p>'],
  ['satisfies-expression', '<p>{("Satisfied" satisfies string)} {label}</p>'],
  ['nonnull-expression', '<p>Non-null {label!}</p>'],
  ['typed-jsx-wrapper', '{(<p>Typed JSX {label}</p> as ReactNode)}'],
  ['generic-component', '<Box<string> value={label}>Generic {label}</Box>'],
  [
    'generic-render-function',
    '{identity<ReactNode>(<p>Generic function {label}</p>)}',
  ],
  ['string-enum', '<p>Enum {Labels.Ready} {label}</p>'],
  ['const-enum', '<p>Const enum {Flags.Active} {count}</p>'],
  ['namespace-render', '{Views.render(label)}'],
  ['namespace-shadow', '{LocalViews.render(label)}'],
  ['overloaded-render', '{renderValue(label)}'],
  ['parameter-property', '{new Presenter(label).render()}'],
  [
    'typed-destructure',
    '{(({ value: alias }: { value: string }) => <p>Typed alias {alias}</p>)({ value: label })}',
  ],
  ['typed-generator', '<div>{Array.from(pages(label))}</div>'],
  [
    'imported-generic-helper',
    '<TypedSlot<string> value={label}><p>Imported typed slot {count}</p></TypedSlot>',
  ],
];

export const apps: ParityApp[] = [
  app(
    '01-literal-regions',
    'Literal text, whitespace, Unicode and expression boundaries.',
    literalCases
  ),
  app(
    '02-nested-ownership',
    'Nested regions, callbacks, slots and manual translation ownership.',
    ownershipCases,
    "import { T, Var } from 'gt-next';"
  ),
  app(
    '03-array-expressions',
    'Literal and dynamic child arrays, nested arrays, and observable React freezing.',
    arrayCases,
    '',
    `
function firstArrayIsFrozen(value: ReactNode): boolean {
  if (Array.isArray(value)) return Object.isFrozen(value);
  if (isValidElement<{ children?: ReactNode }>(value)) return firstArrayIsFrozen(value.props.children);
  return false;
}`
  ),
  app(
    '04-spreads-getters',
    'Children property ordering, spread getters, key evaluation and JSX fallback.',
    spreadCases
  ),
  app(
    '05-runtime-calls',
    'Pre-lowered React runtime calls mixed with raw JSX and manual GT boundaries.',
    runtimeCases,
    `
import { jsx as runtimeJsx, jsxs as runtimeJsxs } from 'react/jsx-runtime';
import * as Runtime from 'react/jsx-runtime';
import { T, Var, Branch } from 'gt-next';`
  ),
  app(
    '06-binding-shadows',
    'Aliases, lexical shadows, function defaults, classes and closure bindings.',
    bindingCases,
    `
import { T, Var, T as Text, T as Übersetzung } from 'gt-next';`
  ),
  app(
    '07-typescript-scopes',
    'Type erasure, generics, enums, namespaces, overloads and imported helpers.',
    typescriptCases,
    `
import { T } from 'gt-next';
import { TypedSlot } from './TypedSlot';`,
    `
function identity<T>(value: T): T { return value; }
function Box<T>({ children }: { value: T; children?: ReactNode }) { return <div>{children}</div>; }
enum Labels { Ready = 'Ready label' }
const enum Flags { Active = 1 }
namespace Views {
  export function render(label: string) { return <p>Namespaced {label}</p>; }
}
namespace LocalViews {
  const T = Echo;
  export function render(label: string) { return <T>Namespace shadow {label}</T>; }
}
function renderValue(value: string): ReactNode;
function renderValue(value: number): ReactNode;
function renderValue(value: string | number): ReactNode { return <p>Overload {value}</p>; }
class Presenter {
  constructor(private readonly label: string) {}
  render() { return <p>Parameter property {this.label}</p>; }
}
function* pages(label: string): Generator<ReactNode> {
  yield <p key="one">Generator one {label}</p>;
  yield <p key="two">Generator two</p>;
}`,
    {
      'src/TypedSlot.tsx': `import type { ReactNode } from 'react';
export function TypedSlot<T>({ value, children }: { value: T; children?: ReactNode }) {
  return <article data-value={String(value)}>{children}</article>;
}
`,
    }
  ),
];
