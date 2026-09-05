import type { Example } from '../types';

// These inputs deliberately exercise syntax rather than component prop types.
// The compiler is the oracle, including its different T and Var boundaries.
const componentNames = [
  'T',
  'Var',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
  'Branch',
  'Plural',
  'Derive',
] as const;

type ComponentName = (typeof componentNames)[number];
type Context = { name: string; wrap: (node: string) => string };
type Content = { name: string; children: string; attributes?: string };

const scope = `const {
  name, count, mode, show, items, label, value, custom,
  settings, context, locales, amount, date
} = props;`;

function page(imports: string, node: string): string {
  return `${imports}
import { Card, renderLabel } from './widgets';

export function Page(props) {
  ${scope}
  return (${node});
}`;
}

const contexts: Context[] = [
  { name: 'root', wrap: (node) => node },
  { name: 'only-child', wrap: (node) => `<section>${node}</section>` },
  {
    name: 'text-parent',
    wrap: (node) => `<section>Before ${node} after {count}</section>`,
  },
  {
    name: 'siblings',
    wrap: (node) =>
      `<main><h1>Account {name}</h1>${node}<footer>Next</footer></main>`,
  },
  {
    name: 'conditional',
    wrap: (node) =>
      `<section>{show ? ${node} : <aside>Empty {name}</aside>}</section>`,
  },
  {
    name: 'slot',
    wrap: (node) => `<Card title={${node}}>Body {name}</Card>`,
  },
];

const manualContexts: Context[] = [
  ...contexts,
  { name: 'manual-parent', wrap: (node) => `<T id="outer">${node}</T>` },
];

const manualContents: Content[] = [
  { name: 'text', children: 'Manual fallback' },
  { name: 'dynamic', children: '{value}' },
  {
    name: 'nested-elements',
    children: '<span>Nested value {name} <b>Count {count}</b></span>',
  },
  {
    name: 'ternary',
    children:
      '{show ? <strong>Visible {name}</strong> : <em>Hidden {count}</em>}',
  },
  { name: 'logical', children: '{show && <span>Visible {name}</span>}' },
  { name: 'nullish', children: '{custom ?? <b>Fallback {name}</b>}' },
  {
    name: 'array',
    children:
      '{[<b key="first">First {name}</b>, value, <em key="last">Last {count}</em>]}',
  },
  {
    name: 'map',
    children: '{items.map((item) => <p key={item.id}>Item {item.label}</p>)}',
  },
  {
    name: 'iife',
    children: '{(() => <p>Computed {name}</p>)()}',
  },
  {
    name: 'nested-manual',
    children:
      'Before <Var name="inner">{show ? <span>Choice {name}</span> : null}</Var> after',
  },
  {
    name: 'nested-branch',
    children:
      '<Branch branch={mode} summary={<b>Summary {name}</b>}>Other {count}</Branch>',
  },
  {
    name: 'nested-slot',
    children:
      '<Card title={<span>Title {name}</span>} footer={show && <i>Footer {count}</i>}>Child {name}</Card>',
  },
  {
    name: 'own-jsx-props',
    attributes:
      'title={<h2>Tooltip {name}</h2>} description={show ? <i>Hint {count}</i> : null}',
    children: '<p>Child {name}</p>',
  },
  {
    name: 'own-prop-nested-var',
    attributes:
      'fallback={<Card title={<span>Title {name}</span>}><Var>{show ? <b>Private {name}</b> : null}</Var></Card>}',
    children: '<><span>Nested {name}</span>{count}</>',
  },
];

const importModes = [
  { name: 'direct', alias: false },
  { name: 'alias', alias: true },
];

function importsFor(component: ComponentName, alias: boolean): string {
  return `import { ${componentNames.join(', ')} } from 'gt-next';${
    alias ? `\nimport { ${component} as Subject } from 'gt-next';` : ''
  }`;
}

export const examples: Example[] = [];

// 6 manual boundaries × 14 child/prop shapes × 7 placements × 2 bindings.
for (const component of componentNames.slice(0, 6)) {
  for (const mode of importModes) {
    const tag = mode.alias ? 'Subject' : component;
    for (const content of manualContents) {
      const node = `<${tag} ${content.attributes ?? ''}>${content.children}</${tag}>`;
      for (const placement of manualContexts) {
        examples.push({
          name: `gt-manual/${component.toLowerCase()}-${mode.name}-${content.name}-${placement.name}`,
          input: page(importsFor(component, mode.alias), placement.wrap(node)),
        });
      }
    }
  }
}

type Opaque = {
  component: ComponentName;
  control: string;
  jsxControl: string;
  contentProp: string;
  alternateProp: string;
};

const opaques: Opaque[] = [
  {
    component: 'Branch',
    control: 'branch={mode}',
    jsxControl: 'branch={<Card>Selector {name}</Card>}',
    contentProp: 'summary',
    alternateProp: 'details',
  },
  {
    component: 'Plural',
    control: 'n={count} locales={locales}',
    jsxControl:
      'n={<Card>Count {count}</Card>} locales={<span>Locale {name}</span>}',
    contentProp: 'one',
    alternateProp: 'other',
  },
  {
    component: 'Derive',
    control: '',
    jsxControl: 'strategy={<Card>Strategy {name}</Card>}',
    contentProp: 'context',
    alternateProp: 'options',
  },
];

function opaqueNodes(tag: string, shape: Opaque) {
  const { control, jsxControl, contentProp: prop, alternateProp: alt } = shape;
  return [
    { name: 'empty', node: `<${tag} />` },
    {
      name: 'literals',
      node: `<${tag} ${control} ${prop}="One" ${alt}="Many">Fallback</${tag}>`,
    },
    {
      name: 'identifiers',
      node: `<${tag} ${control} ${prop}={label} ${alt}={value}>{custom}</${tag}>`,
    },
    {
      name: 'jsx-prop',
      node: `<${tag} ${control} ${prop}={<strong>Named {name} <i>{count}</i></strong>}>Fallback {value}</${tag}>`,
    },
    {
      name: 'nested-jsx-props',
      node: `<${tag} ${control} ${prop}={<Card title={<small>Prop label {name}</small>}>Child {count}</Card>} />`,
    },
    {
      name: 'ternary-prop',
      node: `<${tag} ${control} ${prop}={show ? <b>Shown {name}</b> : <i>Hidden {count}</i>}>Fallback</${tag}>`,
    },
    {
      name: 'map-prop',
      node: `<${tag} ${control} ${prop}={items.map((item) => <li key={item.id}>Row {item.label}</li>)} />`,
    },
    {
      name: 'array-prop',
      node: `<${tag} ${control} ${prop}={['first', <b key="row">Item {name}</b>, value]} />`,
    },
    {
      name: 'array-children',
      node: `<${tag} ${control} children={[<span key="a">First {name}</span>, value, <i key="b">Last {count}</i>]} />`,
    },
    {
      name: 'conditional-children',
      node: `<${tag} ${control}>{show ? <b>First {name}</b> : <span>Second {count}</span>}</${tag}>`,
    },
    {
      name: 'function-children',
      node: `<${tag} ${control}>{() => <span>Lazy {name}</span>}</${tag}>`,
    },
    {
      name: 'key-before-spread',
      node: `<${tag} key={mode} {...settings} ${control} ${prop}={value}>Fallback {name}</${tag}>`,
    },
    {
      name: 'key-after-spread',
      node: `<${tag} {...settings} key={mode} ${control} ${prop}={value}>Fallback {name}</${tag}>`,
    },
    {
      name: 'jsx-controls',
      node: `<${tag} ${jsxControl} ${prop}={label}>Fallback {name}</${tag}>`,
    },
    {
      name: 'data-and-ref-props',
      node: `<${tag} ${control} data-selector={value} data-label={<span>Data {name}</span>} aria-label={label} ref={custom}>Fallback {name}</${tag}>`,
    },
    {
      name: 'nested-opaque',
      node: `<${tag} ${control} ${prop}={<Plural n={count} one={<b>One {name}</b>} other={label}>Many {value}</Plural>}><Derive><Branch branch={mode}>Nested {name}</Branch></Derive></${tag}>`,
    },
    {
      name: 'object-prop',
      node: `<${tag} ${control} ${prop}={{ render: <p>Object {name}</p>, list: [<b key="nested">Nested {count}</b>] }}>Fallback</${tag}>`,
    },
    {
      name: 'duplicate-children',
      node: `<${tag} ${control} children={<p>From prop {name}</p>}>From markup {count}</${tag}>`,
    },
  ];
}

// 3 opaque components × 18 prop shapes × 6 placements × 2 bindings.
for (const shape of opaques) {
  for (const mode of importModes) {
    const tag = mode.alias ? 'Subject' : shape.component;
    for (const content of opaqueNodes(tag, shape)) {
      for (const placement of contexts) {
        examples.push({
          name: `gt-opaque/${shape.component.toLowerCase()}-${mode.name}-${content.name}-${placement.name}`,
          input: page(
            importsFor(shape.component, mode.alias),
            placement.wrap(content.node)
          ),
        });
      }
    }
  }
}

function bindingCases(component: ComponentName, source: string) {
  const node = (tag: string) =>
    `<${tag} title={<span>Title {name}</span>}><strong>Value {name}</strong>{show ? <i>Choice {count}</i> : null}</${tag}>`;
  const namedImport = `import { ${component} } from '${source}';`;
  const shadowImports = `${namedImport}\nimport { Card } from './widgets';`;
  return [
    {
      name: 'named',
      input: page(namedImport, node(component)),
    },
    {
      name: 'named-alias',
      input: page(
        `import { ${component} as Subject } from '${source}';`,
        node('Subject')
      ),
    },
    {
      name: 'string-import-name',
      input: page(
        `import { '${component}' as Subject } from '${source}';`,
        node('Subject')
      ),
    },
    {
      name: 'namespace',
      input: page(
        `import * as Namespace from '${source}';`,
        node(`Namespace.${component}`)
      ),
    },
    {
      name: 'default',
      input: page(`import Subject from '${source}';`, node('Subject')),
    },
    {
      name: 'non-gt-source',
      input: page(
        `import { ${component} } from '${source}/not-gt';`,
        node(component)
      ),
    },
    {
      name: 'assigned-alias',
      input: page(
        `${namedImport}\nconst Subject = ${component};`,
        node('Subject')
      ),
    },
    {
      name: 'destructured-namespace',
      input: page(
        `import * as Namespace from '${source}';\nconst { ${component}: Subject } = Namespace;`,
        node('Subject')
      ),
    },
    {
      name: 'parameter-shadow',
      input: `${shadowImports}
export function Page(props) {
  ${scope}
  function Inner(${component}) { return (${node(component)}); }
  return <main>{Inner(Card)}${node(component)}</main>;
}`,
    },
    {
      name: 'block-shadow',
      input: `${shadowImports}
export function Page(props) {
  ${scope}
  const before = ${node(component)};
  {
    const ${component} = Card;
    const shadow = ${node(component)};
    return <main>{before}{shadow}</main>;
  }
}`,
    },
    {
      name: 'catch-shadow',
      input: `${shadowImports}
export function Page(props) {
  ${scope}
  try { return (${node(component)}); }
  catch (${component}) { return (${node(component)}); }
}`,
    },
    {
      name: 'function-name-shadow',
      input: `${shadowImports}
export function Page(props) {
  ${scope}
  const render = function ${component}() { return (${node(component)}); };
  return <main>{render()}${node(component)}</main>;
}`,
    },
  ];
}

// Named GT imports are recognized by their lexical binding. Namespace imports,
// default imports, and local assignments deliberately remain ordinary JSX.
for (const source of ['gt-next', 'gt-react/browser']) {
  for (const component of componentNames) {
    for (const binding of bindingCases(component, source)) {
      examples.push({
        name: `gt-bindings/${source.replace('/', '-')}-${component.toLowerCase()}-${binding.name}`,
        input: binding.input,
      });
    }
  }
}
