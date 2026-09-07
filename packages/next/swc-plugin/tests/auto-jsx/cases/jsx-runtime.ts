import type { Example } from '../types';

/**
 * Twelve runtime/factory profiles × twenty typed page structures, plus twelve
 * directive-order/placement profiles × two pages = 264 unique source modules.
 * These cover shared Babel/SWC pragma semantics. Their line-comment, nested,
 * and multiple-directives-on-one-line differences belong in actual-host tests.
 * Compiler and CLI production passes author their own outputs independently.
 */
type Runtime = { name: string; pragma: string; imports: string };
type Page = { name: string; source: string };

const runtimes: Runtime[] = [
  {
    name: 'react-automatic',
    pragma: '/** @jsxRuntime automatic */',
    imports: '',
  },
  {
    name: 'react-import-source',
    pragma: '/** @jsxImportSource react */',
    imports: '',
  },
  {
    name: 'emotion-automatic',
    pragma: '/** @jsxImportSource @emotion/react */',
    imports: '',
  },
  {
    name: 'preact-automatic',
    pragma: '/** @jsxImportSource preact */',
    imports: '',
  },
  {
    name: 'relative-automatic',
    pragma: '/** @jsxImportSource ./view-runtime */',
    imports: '',
  },
  {
    name: 'react-prefix-custom',
    pragma: '/** @jsxImportSource react-custom */',
    imports: '',
  },
  {
    name: 'classic-react-default',
    pragma: '/** @jsxRuntime classic */',
    imports: 'import React from "react";',
  },
  {
    name: 'classic-react-namespace',
    pragma:
      '/**\n * @jsxRuntime classic\n * @jsx R.createElement\n * @jsxFrag R.Fragment\n */',
    imports: 'import * as R from "react";',
  },
  {
    name: 'classic-react-named',
    pragma: '/**\n * @jsxRuntime classic\n * @jsx make\n * @jsxFrag Group\n */',
    imports:
      'import { createElement as make, Fragment as Group } from "react";',
  },
  {
    name: 'classic-preact-named',
    pragma: '/**\n * @jsxRuntime classic\n * @jsx h\n * @jsxFrag Fragment\n */',
    imports: 'import { h, Fragment } from "preact";',
  },
  {
    name: 'classic-preact-namespace',
    pragma:
      '/**\n * @jsxRuntime classic\n * @jsx Preact.h\n * @jsxFrag Preact.Fragment\n */',
    imports: 'import * as Preact from "preact";',
  },
  {
    name: 'classic-local-factory',
    pragma:
      '/**\n * @jsxRuntime classic\n * @jsx view.create\n * @jsxFrag view.Group\n */',
    imports: 'import { view } from "./view-runtime";',
  },
];

const declarations = `
import type { ReactNode } from "react";
import { Card, Row, Panel, Layout, Button, LocalChoice } from "./widgets";
import { T as Manual, Var as Value, Branch, Plural, Derive } from "gt-next";
type Person = { id: string; name: string; active: boolean; balance: number };
type Props = { account: Person; rows: Person[]; count: number; mode: string; ready: boolean; fallback: ReactNode; options: Record<string, unknown> };
declare function loadPeople(): Promise<Person[]>;
declare function record(value: unknown): void;
declare function renderNode(value: unknown): ReactNode;
`;

const pages: Page[] = [
  {
    name: 'article-owned-inline',
    source: `export function Page({ account, count }: Props) {
      return <article><h1>Account overview</h1><p>Welcome <strong>{account.name}</strong>, you have {count} updates.</p>
        <aside><b>Current balance</b><span>{account.balance}</span></aside></article>;
    }`,
  },
  {
    name: 'keyed-table-map',
    source: `export const Page = ({ rows, count }: Props) =>
      <table><caption>People ({count})</caption><tbody>{rows.map((row, index) =>
        <tr key={row.id}><th>{index + 1}. {row.name}</th><td>{row.active ? <b>Active account</b> : <i>Awaiting review</i>}</td>
          <td><Button onClick={() => record(row)}>Open {row.name}</Button></td></tr>)}</tbody></table>;`,
  },
  {
    name: 'layout-slot-callbacks',
    source: `export function Page({ account, count }: Props) {
      return <Layout title={<h1>Workspace {account.name}</h1>} sidebar={<nav><a href="/reports">View reports</a></nav>}
        footer={() => <footer>Remaining {count} tasks</footer>}>
        <Card title={<b>Latest report</b>}>Report owner {account.name}<p>Ready for review</p></Card>
      </Layout>;
    }`,
  },
  {
    name: 'conditional-fragment-dashboard',
    source: `export const Page = ({ ready, account, fallback }: Props) => <main>
      {ready ? <section>Signed in as {account.name}<b>Account active</b></section>
        : <><p>Sign in to continue</p>{fallback || <small>Need help?</small>}</>}
      <footer>Account settings</footer></main>;`,
  },
  {
    name: 'switch-return-regions',
    source: `export function Page({ mode, account, count }: Props): ReactNode {
      switch (mode) {
        case "ready": return <section>Welcome back {account.name}<b>{count} messages</b></section>;
        case "pending": return <Panel><h2>Approval pending</h2><p>Contact {account.name}</p></Panel>;
        default: return <><p>Choose an account</p><Button>Continue</Button></>;
      }
    }`,
  },
  {
    name: 'nested-arrays-fragments',
    source: `export function Page({ rows, account }: Props) {
      return <section>Team members {[
        <b key="owner">Owner {account.name}</b>,
        rows.map(row => [<span key={row.id}>Member {row.name}</span>, row.balance]),
        [<><i>End of list</i>{account.name}</>],
      ]}</section>;
    }`,
  },
  {
    name: 'manual-translation-boundaries',
    source: `export const Page = ({ account, ready }: Props) => <main>
      <Manual>Hello <Value>{account.name}</Value><b>Keep this manual</b></Manual>
      <p>Automatic sibling {account.name}<Value>{ready ? <b>Private content</b> : <i>Secret</i>}</Value></p>
      <section><h2>Public account details</h2><span>{account.balance}</span></section>
    </main>;`,
  },
  {
    name: 'branch-plural-derived-content',
    source: `export function Page({ mode, count, account }: Props) {
      return <main><Branch branch={mode} open={<p>Open for {account.name}</p>} closed="Closed" />
        <p><Plural n={count} one="One task" other={<b>{count} tasks</b>} /></p>
        <Derive context="account"><section>Account {account.name}</section></Derive>
      </main>;
    }`,
  },
  {
    name: 'form-labels-and-validation',
    source: `export function Page({ account, ready, options }: Props) {
      return <form {...options}><fieldset><legend>Edit account {account.name}</legend>
        <label htmlFor="name">Display name<input id="name" defaultValue={account.name} /></label>
        <label><input type="checkbox" defaultChecked={ready} />Receive updates</label>
        {ready || <p role="alert">Please confirm your account</p>}
        <Button title="Save account">Save changes</Button></fieldset></form>;
    }`,
  },
  {
    name: 'render-prop-lexical-scopes',
    source: `export const Page = ({ account, count }: Props) => <Card header={<h2>Activity {count}</h2>}
      render={({ item }: { item: Person }) => <section>Selected {item.name}
        <Row render={(account: Person) => <b>Nested account {account.name}</b>} />
      </section>}>Current owner {account.name}</Card>;`,
  },
  {
    name: 'async-typed-page',
    source: `export async function Page({ account }: Props) {
      const rows: Person[] = await loadPeople();
      return <main><h1>Directory for {account.name}</h1><ul>{rows.map(row =>
        <li key={row.id}>Person {row.name}<span>Balance {row.balance}</span></li>)}</ul></main>;
    }`,
  },
  {
    name: 'class-fields-and-methods',
    source: `export class Page {
      title: ReactNode = <h1>Account dashboard</h1>;
      constructor(private props: Props) {}
      render() { return <main>{this.title}<p>Account {this.props.account.name}</p>
        <Card footer={() => <small>Pending {this.props.count}</small>}>Overview</Card></main>; }
    }`,
  },
  {
    name: 'spread-and-key-order',
    source: `export const Page = ({ options, account }: Props) => <main>
      <Card key="before" {...options}>Before spread {account.name}</Card>
      <Card {...options} key={account.id}>After spread {account.name}</Card>
      <Card {...{ children: <p>Literal child {account.name}</p>, label: <b>Card label</b> }} />
    </main>;`,
  },
  {
    name: 'object-getter-and-callback-jsx',
    source: `export function Page({ account, count }: Props) {
      const content = {
        header: <h2>Welcome {account.name}</h2>,
        get body() { return <p>Current count {count}</p>; },
        footer: () => <aside>End of report {account.name}</aside>,
      };
      return <Layout config={content}><h1>Report preview</h1>{renderNode(content)}</Layout>;
    }`,
  },
  {
    name: 'iife-and-function-boundaries',
    source: `export const Page = ({ account, ready }: Props) => <main>Status {(() => {
      const Choice = LocalChoice;
      return ready ? <Choice title={<b>Available now</b>}>Account {account.name}</Choice>
        : (function Pending() { return <p>Waiting for {account.name}</p>; })();
    })()}</main>;`,
  },
  {
    name: 'typed-fragment-exports',
    source: `export const empty: ReactNode = <><p>No selection</p><small>Choose a row</small></>;
      export const Page = ({ account }: Props) =>
        (<><h1>Selected account</h1><section>Hello {account.name}{empty}</section></> satisfies ReactNode);`,
  },
  {
    name: 'try-catch-return-layouts',
    source: `export function Page({ account }: Props) {
      try {
        const body = renderNode(account);
        return <section>Account result {body}<b>Finished loading</b></section>;
      } catch (error) {
        return <Panel title={<h2>Could not load account</h2>}>Retry for {account.name}<Value>{String(error)}</Value></Panel>;
      }
    }`,
  },
  {
    name: 'multiple-exported-components',
    source: `export function Heading({ account }: Props) { return <h1>Team {account.name}</h1>; }
      export const Summary = ({ count }: Props) => <p>Total {count} members</p>;
      export function Page(props: Props) {
        return <main><Heading {...props} /><section>Summary <Summary {...props} /></section><footer>Back to directory</footer></main>;
      }`,
  },
  {
    name: 'custom-elements-and-entities',
    source: `export const Page = ({ account, count }: Props) => <account-panel data-owner={account.id}>
      <h1>Accounts &amp; activity</h1><p>Owner&nbsp;{account.name} &mdash; {count} records</p>
      <status-label aria-label="Account status">Ready &gt; Pending</status-label>
      <button onClick={() => record(<b>Selected {account.name}</b>)}>Open account</button>
    </account-panel>;`,
  },
  {
    name: 'factory-callback-parameter-shadows',
    source: `export function Page({ account, rows }: Props) {
      const render = (React: { createElement: Function; Fragment: unknown }, h: Function, make: Function) =>
        <><p>Local factory {account.name}</p>{rows.map(row => <b key={row.id}>Local row {row.name}</b>)}</>;
      return <Card renderer={render}>Outer factory {account.name}<p>Shared footer</p></Card>;
    }`,
  },
];

const matrix = runtimes.flatMap((runtime) =>
  pages.map(
    (page): Example => ({
      name: 'jsx-runtime/' + runtime.name + '-' + page.name,
      input: [runtime.pragma, runtime.imports, declarations, page.source].join(
        '\n'
      ),
    })
  )
);

const headerCases: Array<{ name: string; header: string }> = [
  {
    name: 'source-custom-then-react',
    header: '/** @jsxImportSource preact */\n/** @jsxImportSource react */',
  },
  {
    name: 'source-react-then-custom',
    header: '/** @jsxImportSource react */\n/** @jsxImportSource preact */',
  },
  {
    name: 'classic-then-automatic',
    header: '/** @jsxRuntime classic */\n/** @jsxRuntime automatic */',
  },
  {
    name: 'automatic-then-classic',
    header: '/** @jsxRuntime automatic */\n/** @jsxRuntime classic */',
  },
  {
    name: 'runtime-then-custom-source',
    header:
      '/**\n * @jsxRuntime automatic\n * @jsxImportSource @emotion/react\n */',
  },
  {
    name: 'custom-source-then-runtime',
    header:
      '/**\n * @jsxImportSource @emotion/react\n * @jsxRuntime automatic\n */',
  },
  {
    name: 'license-block-directive',
    header: '/**\n * Page renderer license.\n * @jsxImportSource preact\n */',
  },
  {
    name: 'client-directive-before-pragma',
    header: '"use client";\n/** @jsxImportSource @emotion/react */',
  },
  {
    name: 'pragma-before-client-directive',
    header: '/** @jsxImportSource preact */\n"use client";',
  },
  {
    name: 'side-effect-import-before-pragma',
    header: 'import "./page-initialization";\n\n/** @jsxImportSource preact */',
  },
  {
    name: 'crlf-docblock',
    header:
      '/**\r\n * @jsxRuntime classic\r\n * @jsx React.createElement\r\n * @jsxFrag React.Fragment\r\n */',
  },
  {
    name: 'bom-before-directive',
    header: '\uFEFF/** @jsxImportSource @emotion/react */',
  },
];

const headers = headerCases.flatMap((header) =>
  [pages[2], pages[15]].map(
    (page): Example => ({
      name: 'jsx-runtime/header-' + header.name + '-' + page.name,
      input: [
        header.header,
        'import React from "react";',
        declarations,
        page.source,
      ].join('\n'),
    })
  )
);

export const examples: Example[] = [...matrix, ...headers];
