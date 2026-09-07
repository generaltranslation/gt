import type { Example } from '../types';

/**
 * 6,760 distinct modules: 10 leaf trees × 13 inner boundaries × 13 outer
 * boundaries × 4 composition depths (2–5). At depths above two, a balanced,
 * deterministic walk selects intermediate boundaries. Every name records the
 * actual grammar path; names and numbers are never substituted into JSX text.
 *
 * Leaves mix static/dynamic content, arrays, opaque GT components, manual
 * boundaries and formatters. Recursive boundaries combine independent props,
 * render callbacks, maps, sparse arrays, explicit children/spreads, conditional
 * alternatives, manual suppression, Branch/Plural content and Derive callbacks.
 * This exercises multiple changes of translation ownership within one page.
 */
interface Leaf {
  name: string;
  jsx: string;
}

interface Boundary {
  name: string;
  wrap: (jsx: string) => string;
}

const leaves: Leaf[] = [
  {
    name: 'inline-message',
    jsx: '<span>Hello {account.name}<b>{account.badge}</b>!</span>',
  },
  {
    name: 'data-without-text',
    jsx: '<span>{account.name}<i>{account.badge}</i>{selected}</span>',
  },
  {
    name: 'independent-fragment',
    jsx: '<Fragment><strong>Active {counts.active}</strong><span>{counts.total}</span><em>Archived</em></Fragment>',
  },
  {
    name: 'nested-array',
    jsx: '<span>{["Selected ", selected, [<b key="inner">Item {account.name}</b>, suffix], ...tail]}</span>',
  },
  {
    name: 'conditional-variants',
    jsx: '<div>{status === "ready" ? <b>Ready {account.name}</b> : <i>Waiting {counts.pending}</i>}</div>',
  },
  {
    name: 'branch-with-plural',
    jsx: '<Branch branch={view} summary={<>Summary {account.name}</>} detail={<div><Plural n={count} one="One item" other={label} /></div>} other={fallback}>Fallback {count}</Branch>',
  },
  {
    name: 'plural-with-derive',
    jsx: '<Plural n={counts.total} locales={localeHints} one={ready ? <b>One {account.name}</b> : <i>Still waiting</i>} other={<span>Many <Derive>{getLabel()}</Derive></span>}>At least {count}</Plural>',
  },
  {
    name: 'derive-with-branch',
    jsx: '<Derive context={format}><Branch branch={status} active={<b>Active {account.name}</b>} other={getLabel()}><span>Fallback {count}</span></Branch></Derive>',
  },
  {
    name: 'manual-islands',
    jsx: '<ManualT id="known">Manual <ManualVar>{ready ? <b>Opaque {value}</b> : alternative}</ManualVar><strong>{label}</strong></ManualT>',
  },
  {
    name: 'formatted-message',
    jsx: '<p>Paid <Currency>{amount}</Currency> on <DateTime>{date}</DateTime><ManualVar>{() => <em>Private {note}</em>}</ManualVar>.</p>',
  },
];

const boundaries: Boundary[] = [
  {
    name: 'text-claim',
    wrap: (jsx) =>
      `<section>Overview <div>${jsx}</div> for {account.name}</section>`,
  },
  {
    name: 'independent-siblings',
    wrap: (jsx) =>
      `<section><header>Record {id}</header>${jsx}<footer>End {count}</footer></section>`,
  },
  {
    name: 'conditional-child',
    wrap: (jsx) =>
      `<section>State {ready ? ${jsx} : <Empty><b>No records</b>{reason}</Empty>}</section>`,
  },
  {
    name: 'logical-fragment',
    wrap: (jsx) =>
      `<Fragment>{visible && (${jsx})}<aside>Hint {hint}</aside></Fragment>`,
  },
  {
    name: 'nullable-slot',
    wrap: (jsx) =>
      `<Card header={content ?? ${jsx}} footer={<small>Updated {date}</small>}>Description {description}</Card>`,
  },
  {
    name: 'render-slot',
    wrap: (jsx) =>
      `<DataView items={items} render={({row, active}) => <Fragment>Row {row.id}{active ? ${jsx} : <i>Inactive</i>}</Fragment>}>Result {total}</DataView>`,
  },
  {
    name: 'mapped-body',
    wrap: (jsx) =>
      `<ul>Members {groups.map(group => <li key={group.id}>{group.title}<div>${jsx}</div><em>Group {group.order}</em></li>)}</ul>`,
  },
  {
    name: 'sparse-array',
    wrap: (jsx) =>
      `<section>{["Start ", , ${jsx}, ["Trailing ", remaining], ...additional]}</section>`,
  },
  {
    name: 'explicit-spread',
    wrap: (jsx) =>
      `<Panel {...{ title: <h2>Panel {title}</h2>, children: ${jsx} }} {...panelProps} footer={<span>Footer {footer}</span>} />`,
  },
  {
    name: 'branch-content',
    wrap: (jsx) =>
      `<Branch branch={mode} selected={${jsx}} empty={<i>Nothing selected {hint}</i>}>Unknown {mode}</Branch>`,
  },
  {
    name: 'plural-content',
    wrap: (jsx) =>
      `<Plural n={count} one={<b>One result {title}</b>} other={${jsx}}>{fallback}</Plural>`,
  },
  {
    name: 'derived-callback',
    wrap: (jsx) =>
      `<section>Derived <Derive>{() => ${jsx}}</Derive> total {count}</section>`,
  },
  {
    name: 'manual-var-boundary',
    wrap: (jsx) =>
      `<section>Private <ManualVar title={<small>Private heading {title}</small>}>{ready ? ${jsx} : <i>Private fallback {fallback}</i>}</ManualVar> public {count}</section>`,
  },
];

function moduleSource(jsx: string): string {
  return `import { Fragment } from 'react';
import { Branch, Plural, Derive, T as ManualT, Var as ManualVar, Currency, DateTime } from 'gt-next';
import { Card, DataView, Empty, Panel } from './components';

export function Page(props) {
  const {
    account, additional, alternative, amount, content, count, counts, date,
    description, fallback, footer, format, getLabel, groups, hint, id, items,
    label, localeHints, mode, note, panelProps, ready, reason, remaining,
    selected, status, suffix, tail, title, total, value, view, visible,
  } = props;
  return (${jsx});
}
`;
}

export const examples: Example[] = [];

for (const depth of [2, 3, 4, 5]) {
  for (const [leafIndex, leaf] of leaves.entries()) {
    for (const [innerIndex, inner] of boundaries.entries()) {
      for (const [outerIndex, outer] of boundaries.entries()) {
        let jsx = inner.wrap(leaf.jsx);
        const route = [inner.name];
        for (let level = 1; level < depth - 1; level++) {
          // Coprime steps distribute every intermediate boundary across each
          // endpoint matrix without sampling, randomness, or fixture filters.
          const index =
            (leafIndex * 3 + innerIndex * 5 + outerIndex * 7 + level * 11) %
            boundaries.length;
          const middle = boundaries[index];
          jsx = middle.wrap(jsx);
          route.push(middle.name);
        }
        jsx = outer.wrap(jsx);
        route.push(outer.name);
        examples.push({
          name: `composition/d${depth}-${leaf.name}-${route.join('-')}`,
          input: moduleSource(jsx),
        });
      }
    }
  }
}
