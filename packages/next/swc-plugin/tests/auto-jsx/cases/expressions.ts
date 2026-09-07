import type { Example } from '../types';

/**
 * Cross expression syntax with translation ownership boundaries. Each axis changes
 * AST structure: static classification, recursive JSX discovery, children arrays,
 * independently processed props, spread ordering, or user component suppression.
 * The compiler harness derives every expected output from these source modules.
 */
const expressions: [string, string][] = [
  ['identifier', 'value'],
  ['member', 'user.profile.name'],
  ['computed-member', 'user[columns[index]]'],
  ['optional-member', 'user?.profile?.name'],
  ['optional-call', 'user?.format?.(locale)'],
  ['string', '"Visible message"'],
  ['empty-string', '""'],
  ['spaces', '"   "'],
  ['line-whitespace', '"\\n\\t\\r"'],
  ['nbsp', '"\\u00a0"'],
  ['zero-width-space', '"\\u200b"'],
  ['unicode-message', '"日本語 مرحباً 👩🏽‍💻"'],
  ['escaped-string', '"Quote: \\" and slash: \\\\"'],
  ['static-template', '`Visible template`'],
  ['empty-template', '``'],
  ['whitespace-template', '` \\n\\t `'],
  ['interpolated-template', '`Welcome ${user.name}, ${count} items`'],
  ['tagged-template', 'format`Value: ${value}`'],
  ['zero', '0'],
  ['decimal', '12.75'],
  ['negative-number', '-3'],
  ['negative-zero', '-0'],
  ['positive-number', '+3'],
  ['bigint', '123n'],
  ['negative-bigint', '-123n'],
  ['boolean-true', 'true'],
  ['boolean-false', 'false'],
  ['null', 'null'],
  ['undefined', 'undefined'],
  ['nan', 'NaN'],
  ['infinity', 'Infinity'],
  ['negative-infinity', '-Infinity'],
  ['void', 'void 0'],
  ['typeof', 'typeof value'],
  ['not', '!enabled'],
  ['binary-sum', 'count + offset'],
  ['string-concatenation', '"$" + amount'],
  ['comparison', 'count > 0'],
  ['call', 'formatValue(value, locale)'],
  ['new-expression', 'new Date(timestamp).toISOString()'],
  ['assignment', '(value = nextValue)'],
  ['sequence', '(track(value), value)'],
  ['ternary-strings', 'enabled ? "Enabled" : "Disabled"'],
  [
    'ternary-jsx',
    'enabled ? <b>Enabled {value}</b> : <i>Disabled {reason}</i>',
  ],
  ['ternary-mixed', 'enabled ? <span>Ready</span> : value'],
  [
    'ternary-nested',
    'a ? (b ? <b>Both {value}</b> : <i>First</i>) : <em>Neither</em>',
  ],
  ['logical-and', 'enabled && <span>Visible {value}</span>'],
  ['logical-chain', 'enabled && ready && <strong>Ready {value}</strong>'],
  ['logical-or', 'value || <span>Default {fallback}</span>'],
  ['nullish', 'value ?? <span>Missing {fallback}</span>'],
  ['nullish-mixed', '(enabled && value) ?? <span>Fallback</span>'],
  ['jsx-only-dynamic', '<span>{value}</span>'],
  ['jsx-text', '<span>Inner {value}</span>'],
  [
    'jsx-independent-prop',
    '<Card title={<b>Title {value}</b>}>Body {other}</Card>',
  ],
  ['fragment-dynamic', '<>{value}</>'],
  ['fragment-text', '<>Inner {value}<strong>emphasis</strong></>'],
  ['empty-array', '[]'],
  ['array-static', '["First", "Second"]'],
  ['array-dynamic', '[first, second]'],
  ['array-mixed', '["First", value, <b key="b">Bold {other}</b>]'],
  ['array-holes', '[, "Visible", , value, ,]'],
  ['array-spread', '[...values, "Tail", <b key="b">Bold</b>]'],
  ['array-nested-plain', '[["First", value], ["Second", other]]'],
  [
    'array-nested-jsx',
    '["First", [<b key="b">Bold {value}</b>, ["Deep", other]]]',
  ],
  [
    'array-nested-spread',
    '[...["First", value], ...nested.map(x => [<i key={x.id}>Item {x.name}</i>])]',
  ],
  ['object-member', '({ label: <span>Object {value}</span> }).label'],
  ['object-computed', '({ [key]: <span>Computed {value}</span> })[key]'],
  [
    'map-expression',
    'items.map(item => <li key={item.id}>Item {item.name}</li>)',
  ],
  [
    'map-block',
    'items.map(item => { if (!item.active) return null; return <li key={item.id}>Active {item.name}</li>; })',
  ],
  [
    'flatmap',
    'groups.flatMap(group => group.items.map(item => <li key={item.id}>In {group.name}: {item.name}</li>))',
  ],
  [
    'reduce',
    'items.reduce((nodes, item) => [...nodes, <b key={item.id}>Item {item.name}</b>], [])',
  ],
  [
    'filter-map',
    'items.filter(item => item.active).map(({ id, name }) => <li key={id}>Selected {name}</li>)',
  ],
  ['arrow', '() => <span>Deferred {value}</span>'],
  ['typed-arrow', '(item: { name: string }) => <span>Typed {item.name}</span>'],
  ['iife', '(() => <span>Immediate {value}</span>)()'],
  [
    'iife-block',
    '(() => { const label = <b>Local {value}</b>; return ready ? label : <i>Pending</i>; })()',
  ],
  [
    'function-iife',
    '(function render() { return <span>Function {value}</span>; })()',
  ],
  ['async-iife', '(async () => <span>Async {await getValue()}</span>)()'],
  [
    'generator',
    '[...(function* () { yield <span>Yielded {value}</span>; yield "Tail"; })()]',
  ],
  ['ts-as', '(value as string)'],
  ['ts-non-null', 'value!'],
  ['ts-satisfies', '(value satisfies string)'],
  ['ts-jsx-assertion', '(<span>Asserted {value}</span> as React.ReactNode)'],
  ['ts-const-array', '(["Fixed", <b key="b">Bold {value}</b>] as const)'],
  ['parenthesized-jsx', '((<span>Parenthesized {value}</span>))'],
  ['regexp-call', '/^[a-z]+$/i.test(value)'],
];

const contexts: [string, (expression: string) => string][] = [
  ['only', (value) => `<div>{${value}}</div>`],
  ['prefix', (value) => `<div>Result: {${value}}</div>`],
  ['suffix', (value) => `<div>{${value}} remaining</div>`],
  ['sandwich', (value) => `<div>Before {${value}} after</div>`],
  [
    'separate-expressions',
    (value) => `<p>{first} says {${value}} to {last}.</p>`,
  ],
  [
    'whitespace-boundary',
    (value) => `<p>{first}{' '}{${value}}{'\\n'}{last}</p>`,
  ],
  [
    'deep-independent',
    (value) =>
      `<main><section><article><p>{${value}}</p></article></section></main>`,
  ],
  [
    'deep-claimed',
    (value) =>
      `<main>Report <section><article><p>{${value}}</p></article></section> complete</main>`,
  ],
  [
    'sibling-boundaries',
    (value) =>
      `<main><h1>Report</h1><section>{${value}}</section><footer>Updated {date}</footer></main>`,
  ],
  ['fragment', (value) => `<>Status {${value}}<span>{other}</span></>`],
  [
    'keyed-fragment',
    (value) => `<Fragment key={id}><b>Heading</b>{${value}}</Fragment>`,
  ],
  ['explicit-children', (value) => `<Card children={${value}} />`],
  [
    'explicit-children-array',
    (value) => `<Card children={['Result: ', ${value}, suffix]} />`,
  ],
  [
    'children-before-spread',
    (value) => `<Card children={${value}} {...props} />`,
  ],
  [
    'children-after-spread',
    (value) => `<Card {...props} children={${value}} />`,
  ],
  [
    'children-overridden',
    (value) => `<Card children={${value}}>Replacement {replacement}</Card>`,
  ],
  [
    'prop-jsx',
    (value) =>
      `<Card header={<h1>Heading {${value}}</h1>} footer={<small>End {date}</small>}>Body {body}</Card>`,
  ],
  ['prop-expression', (value) => `<Card header={${value}}>Body {body}</Card>`],
  [
    'render-prop',
    (value) =>
      `<Card render={() => <section>Rendered {${value}}</section>}>Body</Card>`,
  ],
  ['user-t', (value) => `<ManualT>Manual {${value}}</ManualT>`],
  [
    'user-var',
    (value) => `<p>Value <ManualVar>{${value}}</ManualVar> after {other}</p>`,
  ],
  ['nested-array', (value) => `<div>{['Result', [${value}], ...values]}</div>`],
  [
    'jsx-entities',
    (value) => `<p>&quot;A&amp;B&quot;&nbsp;{${value}}&#x1f30d;</p>`,
  ],
  [
    'multiline',
    (value) => `<p>
    A line before
    {${value}}
    <span>next line {other}</span>
    and after
  </p>`,
  ],
];

export const examples: Example[] = expressions.flatMap(([name, expression]) =>
  contexts.map(([context, render]) => ({
    name: `expressions/${name}-${context}`,
    input: `import * as React from 'react';
import { Fragment } from 'react';
import { T as ManualT, Var as ManualVar } from 'gt-next';
export const Page = () => (${render(expression)});
`,
  }))
);
