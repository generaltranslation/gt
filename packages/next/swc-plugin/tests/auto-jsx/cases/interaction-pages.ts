import type { Example } from '../types';

/**
 * A deterministic interaction matrix: 30 page layouts × 20 expression shapes
 * × 10 module/execution contexts = 6,000 independently named input modules.
 *
 * Each axis changes traversal or binding behavior. These are intentionally
 * syntax fixtures, including ReactNode values that a particular component may
 * reject at runtime. All expected output comes from the compiler oracle.
 */
type ExpressionCase = { name: string; source: string };
type Layout = { name: string; render: (expression: string) => string };
type ModuleContext = {
  name: string;
  importSource: string;
  stringImports?: boolean;
  render: (body: string) => string;
};

const expressions: ExpressionCase[] = [
  { name: 'member', source: 'account.profile.name' },
  {
    name: 'optional-nullish',
    source: 'account?.profile?.displayName ?? fallback',
  },
  {
    name: 'interpolated-template',
    source: '`Hello ${account.name}, record ${count + 1}`',
  },
  {
    name: 'conditional-elements',
    source:
      'enabled ? <strong>Active {account.name}</strong> : <em>Pending {fallback}</em>',
  },
  {
    name: 'logical-opaque',
    source:
      'enabled && <Choice branch={mode} one={<b>Owned {account.name}</b>} other={fallback} />',
  },
  {
    name: 'nullish-plural',
    source:
      'selection ?? <Forms n={count} one="entry" other={<span>{count} entries</span>} />',
  },
  {
    name: 'map-manual-value',
    source:
      'rows.map((row, index) => <Row key={row.id} label={<b>Row {index + 1}</b>}>{row.name}<Value>{row.secret}</Value></Row>)',
  },
  {
    name: 'flatmap-keyed-fragments',
    source:
      'rows.flatMap(row => [<b key={row.id}>Top {row.name}</b>, <Fragment key={row.id + "-tail"}>Tail {row.value}</Fragment>])',
  },
  {
    name: 'iife-shadowed-branch',
    source:
      '(() => { const Choice = LocalChoice; return <Choice label={<b>Local label {count}</b>}>Inner {account.name}</Choice>; })()',
  },
  {
    name: 'named-function-manual',
    source:
      '(function RenderValue() { return <Manual>Manual result <Value>{account.name}</Value><b>Stable label</b></Manual>; })()',
  },
  {
    name: 'reduce-elements',
    source:
      'Object.entries(data).reduce((nodes, [entryKey, value]) => nodes.concat(<p key={entryKey}>Entry {entryKey}: {value}</p>), [])',
  },
  {
    name: 'array-hole-spread',
    source:
      '[<span key="first">First {account.name}</span>, , ...items, <Choice key="last" branch={mode} one="Selected" other={fallback} />]',
  },
  {
    name: 'sequence-jsx-effects',
    source:
      '(record(<span>Debug {count}</span>), <section>After recording {account.name}</section>)',
  },
  {
    name: 'generator-iife',
    source:
      '(function* renderSteps() { yield <b>First step {count}</b>; return <Forms n={count} one="step" other="steps" />; })()',
  },
  {
    name: 'async-iife',
    source:
      '(async () => { const result = await fetchValue(); return <p>Loaded {result.name}</p>; })()',
  },
  {
    name: 'class-expression',
    source:
      'new (class { node = <b>Field {count}</b>; render() { return <p>Class value {account.name}{this.node}</p>; } })().render()',
  },
  {
    name: 'object-getter-callback',
    source:
      'createNode({ header: <h3>Node {count}</h3>, get body() { return <Forms n={count} one="item" other="items" />; }, footer: () => <aside>End {account.name}</aside> })',
  },
  {
    name: 'destructured-shadow',
    source:
      'rows.map(({ Choice = LocalChoice, ...row }) => <Choice children={<span>Locally bound {row.name}</span>} />)',
  },
  {
    name: 'direct-derived-fragment',
    source:
      '<Fragment key={key}>Fragment <Derived context={context}>{resolveName()}</Derived> tail {count}</Fragment>',
  },
  {
    name: 'typed-conditional',
    source:
      '((enabled ? <Box>Question {account.name}</Box> : <Box>{fallback}</Box>) satisfies React.ReactNode)',
  },
];

const layouts: Layout[] = [
  {
    name: 'dashboard-callback-slots',
    render: (value) => `<Dashboard title={<h1>Workspace {account.name}</h1>}
      actions={<nav>{rows.map(row => <button key={row.id} onClick={() => record(<p>Selected {row.name}</p>)}>Open {row.name}</button>)}</nav>}
      footer={() => <footer>Last result {${value}}</footer>}>
      Welcome <section>{${value}}</section><Manual>Help center</Manual>
    </Dashboard>`,
  },
  {
    name: 'table-render-callbacks',
    render: (value) => `<table><caption>Grouped results {count}</caption><tbody>
      {rows.map((row, index) => <Fragment key={row.id}><tr>
        <th>{row.name}</th><td>Cell {${value}}</td>
        <td><Card render={({ active }) => active ? <b>Active {${value}}</b> : <Value>{row.raw}</Value>} /></td>
      </tr>{row.children?.map(child => <tr key={child.id}><td colSpan={index + 1}>Nested {child.name}</td></tr>)}</Fragment>)}
    </tbody></table>`,
  },
  {
    name: 'suspense-fallback-slots',
    render: (value) => `<main><h1>Deferred dashboard</h1>
      <Suspense fallback={<Panel title={<h2>Loading {count}</h2>}>Please wait {${value}}</Panel>}>
        <Card load={async () => <article>Resolved {${value}}</article>}>{${value}}</Card>
      </Suspense><aside>Continue when ready</aside></main>`,
  },
  {
    name: 'nested-logical-fallbacks',
    render: (value) => `<section>View {mode}: {enabled
      ? <Panel summary={selection && <p>Selection {${value}}</p>}>
          {selection ? <article>Selected {${value}}</article> : <article>No selection</article>}
        </Panel>
      : <aside>{fallback || <b>Unavailable {${value}}</b>}</aside>} after {count}
    </section>`,
  },
  {
    name: 'duplicate-children-boundaries',
    render: (value) => `<main><Card children={${value}} {...options}
      children={<section>Later property {${value}}</section>}
      header={<h2>Independent header {count}</h2>}>
      Final body <span>{${value}}</span>
    </Card><footer>End {count}</footer></main>`,
  },
  {
    name: 'literal-spread-children-first',
    render: (value) => `<main><Card {...{
      children: ['Spread content ', ${value}, <b key="end">Spread end {count}</b>],
      caption: <span>Spread slot {${value}}</span>,
    }} {...options} footer={<aside>Footer {account.name}</aside>} />
    <p>Following element {count}</p></main>`,
  },
  {
    name: 'quoted-spread-child-key',
    render: (value) => `<Card {...{
      'children': <section>Quoted property {${value}}</section>,
      [mode]: () => <p>Computed callback {${value}}</p>,
    }} children={<p>Explicit children {count}</p>}>
      Syntactic children {${value}}
    </Card>`,
  },
  {
    name: 'key-after-spread-fallback',
    render: (value) => `<main>Container <Card {...options} key={key}
      title={<h2>Key after spread {count}</h2>}>
      Card body {${value}}<Choice branch={mode} one={<b>First {account.name}</b>} other={fallback} />
    </Card> tail {count}</main>`,
  },
  {
    name: 'key-before-spread-runtime',
    render: (value) => `<main>Container <Card key={key} {...options}
      title={<h2>Key before spread {count}</h2>}>
      Card body {${value}}<Choice branch={mode} one={<b>First {account.name}</b>} other={fallback} />
    </Card> tail {count}</main>`,
  },
  {
    name: 'nested-spreads-prototype-boundary',
    render: (value) => `<main><Card {...{
      __proto__: prototype,
      children: <section>Prototype content {${value}}</section>,
      render: () => <p>Prototype callback {count}</p>,
    }} {...{ ...options, children: <b>Outer literal {${value}}</b> }}>
      Body after spreads {count}
    </Card><aside>Following {account.name}</aside></main>`,
  },
  {
    name: 'opaque-choice-content-controls',
    render: (
      value
    ) => `<section>Choice <Choice branch={mode} data-current={selection}
      primary={${value}} secondary={<Card title={<b>Nested slot {${value}}</b>}>Nested body {count}</Card>}
      fallback={() => <p>Callback fallback {${value}}</p>}>
      Default <span>{${value}}</span>
    </Choice> after {account.name}</section>`,
  },
  {
    name: 'plural-content-and-fallback',
    render: (
      value
    ) => `<Card title={<h2>Count {count}</h2>}><Forms n={count} locales={options.locales}
      one={${value}} other={<span>Many <strong>{${value}}</strong> entries</span>}
      zero={enabled ? <b>None {account.name}</b> : <Value>{fallback}</Value>}>
      Default count {${value}}
    </Forms><p>After count {count}</p></Card>`,
  },
  {
    name: 'derive-nested-opaque-units',
    render: (
      value
    ) => `<main>Derived <Derived context={context} label={${value}}>
      {enabled ? <Choice branch={mode} first={${value}} other={<b>Other {count}</b>} />
        : <section>Derived fallback {${value}}</section>}
      <Forms n={count} one="entry" other={<b>Entries {account.name}</b>} />
    </Derived> after {count}</main>`,
  },
  {
    name: 'manual-translation-prop-subtrees',
    render: (value) => `<main><Manual id="manual-unit"
      heading={<h2>Manual prop {${value}}</h2>}
      render={() => <p>Manual callback {${value}}</p>}>
      Manual content {${value}}<b>Direct descendant {count}</b>
      <Choice branch={mode} first={<p>Marked branch prop {account.name}</p>} other={fallback} />
    </Manual><p>Automatic sibling {count}</p></main>`,
  },
  {
    name: 'manual-value-all-boundaries',
    render: (value) => `<section>Before <Value details={${value}}
      label={<h3>Opaque label {count}</h3>}>
      {() => <article>Opaque callback {${value}}</article>}
      <Choice branch={mode} first={${value}} other={<b>Opaque branch</b>} />
    </Value> after {${value}}<p>Automatic sibling {count}</p></section>`,
  },
  {
    name: 'namespace-versus-named-components',
    render: (value) => `<main>Before <GT.Branch branch={mode}
      first={<p>Namespace prop {${value}}</p>} other={fallback}>
      Namespace body {${value}}<GT.Var>{enabled ? <b>Namespace value {count}</b> : fallback}</GT.Var>
    </GT.Branch><Choice branch={mode} first={${value}} other="Named fallback" /> after
    <GT.T><b>Namespace translation {account.name}</b></GT.T></main>`,
  },
  {
    name: 'render-prop-destructured-shadows',
    render: (value) => `<Card title={<h1>Render selection {count}</h1>}
      render={({ Choice = LocalChoice, Value = LocalValue, selected }) => <section>
        <Choice branch={mode} one={<p>Local choice prop {${value}}</p>}>Local body {selected}</Choice>
        <Value>{enabled ? <b>Local value {${value}}</b> : selected}</Value>
      </section>}>
      Named value <Value>{${value}}</Value>
    </Card>`,
  },
  {
    name: 'event-handler-jsx-scopes',
    render: (value) => `<main><button onClick={() => {
      const result = <section>Recorded value {${value}}</section>;
      return record({ result, confirm: () => <Choice branch={mode} yes={<b>Confirmed {count}</b>} no={fallback} /> });
    }}>Click {account.name}</button>
    <form onSubmit={async event => { await submit(event); return <p>Submitted {${value}}</p>; }}>
      Form body {${value}}
    </form></main>`,
  },
  {
    name: 'object-method-render-props',
    render: (value) => `<Card adapters={{
      get heading() { return <h2>Getter heading {${value}}</h2>; },
      render(row) { return <section>Method {row.name}{${value}}</section>; },
      async load() { await fetchValue(); return <p>Loaded slot {count}</p>; },
      *steps() { yield <p>First slot {${value}}</p>; return <p>Last slot</p>; },
    }}><section>Visible body {count}</section></Card>`,
  },
  {
    name: 'nested-array-shapes',
    render: (value) => `<section>{['Intro ',
      [<span key="nested">Nested {${value}}</span>, ${value}],
      ...values,
      null,
      <Choice key="choice" branch={mode} first={${value}} other="Other" />,
    ]}</section>`,
  },
  {
    name: 'explicit-array-prop-with-tail',
    render: (
      value
    ) => `<main><Card children={['Array head ', ${value}, <b key="tail">Tail {count}</b>]}
      secondary={<Panel children={['Secondary ', ${value}]} />} />
      <p>{[${value}, <em key="only">One more {account.name}</em>]}</p>
    </main>`,
  },
  {
    name: 'keyed-fragments-and-mapped-arrays',
    render: (value) => `<Fragment key={key}>Start {rows.map(row => [
      <Fragment key={row.id}><h3>Heading {row.name}</h3>{${value}}</Fragment>,
      row.open ? <section key={row.id + '-open'}>Open {${value}}</section> : null,
    ])}<><p>Fragment sibling {count}</p><Choice branch={mode} first={${value}} other="End" /></></Fragment>`,
  },
  {
    name: 'loop-and-block-shadow-restoration',
    render: (value) => `<main>{(() => {
      const result = [];
      for (const row of rows) {
        { const Choice = LocalChoice; result.push(<Choice label={<b>Block {row.name}</b>}>Local {${value}}</Choice>); }
        result.push(<Choice branch={mode} first={<b>Restored {${value}}</b>} other={row.name} />);
      }
      return result;
    })()}<footer>After loop {count}</footer></main>`,
  },
  {
    name: 'switch-catch-finally-scopes',
    render: (value) => `<main>{(() => {
      try {
        switch (mode) {
          case 'first': { const Value = LocalValue; return <Value>Local case {${value}}</Value>; }
          case 'second': return <Choice branch={mode} first={${value}} other="Second fallback" />;
          default: return <p>Default case {${value}}</p>;
        }
      } catch (Choice) { return <Choice>Catch content {${value}}</Choice>; }
      finally { record(<span>Finished {count}</span>); }
    })()}<p>After switch {account.name}</p></main>`,
  },
  {
    name: 'nested-class-private-rendering',
    render: (value) => `<main>{(() => {
      class Renderer {
        #label = <b>Private label {count}</b>;
        get fallback() { return <p>Class fallback {${value}}</p>; }
        render(Value = LocalValue) { return <Value>{this.#label}<section>Method value {${value}}</section></Value>; }
        static make() { return <Choice branch={mode} first={${value}} other="Static fallback" />; }
      }
      return <Card renderer={new Renderer()} title={Renderer.make()}>{new Renderer().render()}</Card>;
    })()}<p>After class {count}</p></main>`,
  },
  {
    name: 'spread-getter-children-property',
    render: (value) => `<Card {...{
      get children() { return <section>Getter children {${value}}</section>; },
      set value(next) { record(<p>Setter {next}</p>); },
      header() { return <h2>Method header {${value}}</h2>; },
    }} footer={<aside>Footer {count}</aside>}>
      Ordinary children <b>{${value}}</b>
    </Card>`,
  },
  {
    name: 'member-components-with-functions',
    render: (
      value
    ) => `<Widgets.Grid title={<Widgets.Heading>Grid {account.name}</Widgets.Heading>}>
      {rows.map(row => <Widgets.Cell key={row.id}
        fallback={() => <Widgets.Empty>Empty {${value}}</Widgets.Empty>}
        details={<Choice branch={mode} first={${value}} other={row.name} />}>
        Cell <Widgets.Label>{${value}}</Widgets.Label>
      </Widgets.Cell>)}
    </Widgets.Grid>`,
  },
  {
    name: 'four-level-control-flow',
    render: (value) => `<main>Root {enabled
      ? <section>Level one {rows.map(row => row.open
          ? <article key={row.id}>Level two {row.children?.map(child => child.active
              ? <Card key={child.id} title={<h3>Level three {${value}}</h3>}>Level four {${value}}</Card>
              : <p key={child.id}>Inactive {${value}}</p>)}</article>
          : <aside key={row.id}>Closed {${value}}</aside>)}</section>
      : <footer>Disabled {${value}}</footer>} root tail {count}</main>`,
  },
  {
    name: 'generic-render-factory',
    render: (value) => `<main>{withRenderer<RowData>({
      render: (row: RowData) => <section>Typed row {row.name}{${value}}</section>,
      empty: <p>No typed rows {count}</p>,
      decorate: <Item extends RowData,>(row: Item) => <Card title={<h3>Generic {row.name}</h3>}>
        <Derived>{${value}}</Derived><p>Generic tail {count}</p>
      </Card>,
    })}<footer>Factory result {account.name}</footer></main>`,
  },
  {
    name: 'assignment-sequence-children',
    render: (
      value
    ) => `<main><Card children={(slots.header = <h2>Assigned header {${value}}</h2>, ${value})}
      fallback={(slots.footer ??= <aside>Assigned footer {${value}}</aside>)}>
      {enabled && (slots.selected = <p>Selected {${value}}</p>)}
      Final visible children {count}
    </Card><footer>After assignment {account.name}</footer></main>`,
  },
];

const scope = `const {
  account, rows, items, count, mode, enabled, fallback, selection, data,
  options, key, context, values, prototype, slots,
} = props;`;

const contexts: ModuleContext[] = [
  {
    name: 'arrow-next',
    importSource: 'gt-next',
    render: (body) => `export const Page = (props: PageProps) => {
      ${scope}
      return (${body});
    };`,
  },
  {
    name: 'async-function-react',
    importSource: 'gt-react',
    render: (body) => `export async function Page(props: PageProps) {
      ${scope}
      const ready = await preload();
      return <Shell ready={ready} preview={<p>Async preview {count}</p>}>${body}</Shell>;
    }`,
  },
  {
    name: 'generic-string-imports',
    importSource: 'gt-next',
    stringImports: true,
    render: (
      body
    ) => `export function Page<Choice extends React.ElementType>(props: PageProps) {
      ${scope}
      return (${body});
    }`,
  },
  {
    name: 'async-arrow-client',
    importSource: 'gt-react/client',
    render: (body) => `export const Page = async (props: PageProps) => {
      ${scope}
      await preload();
      return <><p>Async arrow preview {count}</p>${body}</>;
    };`,
  },
  {
    name: 'parameter-shadow-server',
    importSource: 'gt-next/server',
    render: (
      body
    ) => `export function Page({ Choice = LocalChoice, ...props }: PageProps) {
      ${scope}
      return <section>Shadowed module ${body}<Value>{account.name}</Value></section>;
    }`,
  },
  {
    name: 'local-value-shadow-browser',
    importSource: 'gt-react/browser',
    render: (body) => `export function Page(props: PageProps) {
      ${scope}
      const Value = LocalValue;
      const before = <Choice branch={mode} first={<b>Before module {count}</b>} other={fallback} />;
      return <>{before}${body}<p>After local shadow {count}</p></>;
    }`,
  },
  {
    name: 'class-fields-and-getters',
    importSource: 'gt-next',
    render: (body) => `export class Page extends React.Component<PageProps> {
      #ready = true;
      fallback = <p>Class field fallback {this.props.count}</p>;
      get preview() { return <aside>Class getter preview {this.props.mode}</aside>; }
      render() {
        const props = this.props;
        ${scope}
        return <Shell ready={this.#ready} fallback={this.fallback} preview={this.preview}>${body}</Shell>;
      }
    }`,
  },
  {
    name: 'object-method-default',
    importSource: 'gt-i18n',
    render: (body) => `export const pages = {
      Page(props: PageProps, placeholder = <p>Parameter placeholder</p>) {
        ${scope}
        return <Shell fallback={placeholder}>${body}</Shell>;
      },
      get empty() { return <p>Independent getter page</p>; },
    };`,
  },
  {
    name: 'generator-steps',
    importSource: 'gt-next',
    render: (body) => `export function* Page(props: PageProps) {
      ${scope}
      yield <section>Generator preparation <Value>{account.name}</Value></section>;
      const result = (${body});
      yield <Card preview={result}>Intermediate step {count}</Card>;
      return result;
    }`,
  },
  {
    name: 'async-generator-steps',
    importSource: 'gt-react',
    render: (body) => `export async function* Page(props: PageProps) {
      ${scope}
      await preload();
      yield <section>Async preparation {account.name}</section>;
      const result = (${body});
      return <Shell preview={<p>Final preview {count}</p>}>{result}</Shell>;
    }`,
  },
];

function imports(context: ModuleContext): string {
  const name = (value: string) =>
    context.stringImports ? JSON.stringify(value) : value;
  return `import * as React from 'react';
import { Fragment, Suspense } from 'react';
import * as GT from '${context.importSource}';
import {
  ${name('T')} as Manual, ${name('Var')} as Value,
  ${name('Num')} as Count, ${name('Currency')} as Money,
  ${name('DateTime')} as When, ${name('RelativeTime')} as Relative,
  ${name('Branch')} as Choice, ${name('Plural')} as Forms, ${name('Derive')} as Derived,
} from '${context.importSource}';
import * as Widgets from './widgets';
import {
  Box, Card, Dashboard, LocalChoice, LocalValue, Panel, Row, Shell,
  createNode, fetchValue, preload, record, resolveName, submit, withRenderer,
} from './widgets';
type PageProps = Record<string, any>;
type RowData = { id: string; name: string; [key: string]: unknown };
`;
}

export const examples: Example[] = contexts.flatMap((context) =>
  layouts.flatMap((layout) =>
    expressions.map((expression) => ({
      name: `interaction-pages/${layout.name}-${expression.name}-${context.name}`,
      input: `${imports(context)}\n${context.render(layout.render(expression.source))}\n`,
    }))
  )
);
