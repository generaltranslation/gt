import type { Example } from '../types';

const bindings = [
  { name: 'intrinsic', imports: '', tag: 'style' },
  {
    name: 'default',
    imports: "import Style from 'styled-jsx/style';",
    tag: 'Style',
  },
  {
    name: 'named-default',
    imports: "import { default as Css } from 'styled-jsx/style';",
    tag: 'Css',
  },
  {
    name: 'namespace',
    imports: "import * as styles from 'styled-jsx/style';",
    tag: 'styles.default',
  },
];

const layouts = [
  { name: 'css-only', render: (css: string) => css },
  {
    name: 'direct-text-siblings',
    render: (css: string) => `<main>Before${css}After {label}</main>`,
  },
  {
    name: 'independent-text-elements',
    render: (css: string) =>
      `<main><h2>Heading {label}</h2>${css}<p>Body {count}</p></main>`,
  },
  {
    name: 'nested-region',
    render: (css: string) =>
      `<main>Intro<section>Inside ${css}Tail {count}</section>Outro {label}</main>`,
  },
  {
    name: 'leading-style',
    render: (css: string) =>
      `<section>${css}Leading content {label}<strong>Emphasis {count}</strong></section>`,
  },
  {
    name: 'trailing-style',
    render: (css: string) =>
      `<section>Trailing content {label}<strong>Emphasis {count}</strong>${css}</section>`,
  },
  {
    name: 'adjacent-styles',
    render: (css: string) => `<section>First${css}${css}Last {label}</section>`,
  },
  {
    name: 'fragment-region',
    render: (css: string) => `<>Before${css}After {label}</>`,
  },
  {
    name: 'conditional-boundary',
    render: (css: string) =>
      `<main>Before{shown ? ${css} : null}After {label}</main>`,
  },
  {
    name: 'callback-boundary',
    render: (css: string) =>
      `<main>Before{(() => ${css})()}After {label}</main>`,
  },
  {
    name: 'whitespace-segments',
    render: (css: string) =>
      `<main>\n  ${css}\n  <p>Content {label}</p>\n</main>`,
  },
  {
    name: 'dynamic-only-segment',
    render: (css: string) => `<main>Before${css}{label}</main>`,
  },
];

export const examples: Example[] = bindings.flatMap((binding) =>
  layouts.map((layout) => ({
    name: `styles/${binding.name}-${layout.name}`,
    input: `${binding.imports}
export function Page({ count, shown, label }: { count: number; shown: boolean; label: string }) {
  return ${layout.render(`<${binding.tag} jsx id="fixture-css">{\`main { color: red; padding-left: \${count}px; }\`}</${binding.tag}>`)};
}`,
  }))
);

examples.push(
  {
    name: 'styles/shadowed-default-import',
    input: `import Style from 'styled-jsx/style';
export function Page({ Style, label }) { return <section>Before<Style>Component {label}</Style>After</section>; }
export const css = <Style>{'p { color: red; }'}</Style>;`,
  },
  {
    name: 'styles/unrelated-style-component',
    input: `import Style from './user-style';
export function Page({ label }) { return <Style>Ordinary component {label}</Style>; }`,
  },
  {
    name: 'styles/whole-payload-opaque',
    input: `export function Page({ renderCss, label }) { return <main><style data-template={<b>Example {label}</b>}>{renderCss(() => <span>Payload example</span>)}</style><p>Ordinary text {label}</p></main>; }`,
  }
);

for (const source of ['@emotion/react', './custom']) {
  for (const tag of ['style', 'script', 'title', 'textarea']) {
    examples.push({
      name: `protected-content/mixed-custom-runtime-${source === './custom' ? 'relative' : 'package'}-${tag}`,
      input: `/** @jsxImportSource ${source} */
      import {jsxs as hs} from 'react/jsx-runtime';
      export function Page({label, payload}) {
        return hs('main', {children:['Before', <${tag}>{payload}</${tag}>, 'After ', label]});
      }`,
    });
  }
}

for (const tag of ['style', 'script', 'title', 'textarea']) {
  examples.push({
    name: `protected-content/authored-custom-runtime-${tag}`,
    input: `import {jsx as custom} from '@emotion/react/jsx-runtime';
    export function Page({label, payload}) {
      return <main>Before{custom('${tag}', {children:payload})}After {label}</main>;
    }`,
  });
}

for (const tag of ['title', 'textarea', 'script']) {
  for (const layout of layouts) {
    examples.push({
      name: `protected-content/${tag}-${layout.name}`,
      input: `export function Page({ count, shown, label }) {
        return ${layout.render(`<${tag} id="fixture-payload">Original text payload</${tag}>`)};
      }`,
    });
  }
}

for (const tag of ['style', 'title', 'textarea', 'script']) {
  examples.push({
    name: `protected-content/${tag}-key-after-spread`,
    input: `export function Page({ props, id, content, label }) {
      return <main>Before<${tag} {...props} key={id}>{content}</${tag}>After {label}</main>;
    }`,
  });
}

const createElementBindings = [
  {
    name: 'named',
    imports: "import { createElement as create } from 'react';",
    factory: 'create',
  },
  {
    name: 'default',
    imports: "import React from 'react';",
    factory: 'React.createElement',
  },
  {
    name: 'namespace',
    imports: "import * as React from 'react';",
    factory: 'React.createElement',
  },
  {
    name: 'computed',
    imports: "import * as React from 'react';",
    factory: 'React["createElement"]',
  },
  {
    name: 'named-default',
    imports: "import { default as React } from 'react';",
    factory: 'React.createElement',
  },
];

for (const binding of createElementBindings) {
  for (const tag of ['style', 'title', 'textarea', 'script', 'Style']) {
    examples.push({
      name: `protected-content/create-element-${binding.name}-${tag.toLowerCase()}${tag === 'Style' ? '-component' : ''}`,
      input: `${binding.imports}
      import Style from 'styled-jsx/style';
      import { jsx as h } from 'react/jsx-runtime';
      export function Page({ label, payload }) {
        return <main>Before{${binding.factory}(${tag === 'Style' ? tag : `'${tag}'`}, {id:'protected-payload', 'data-content': h('b', {children:'Untouched prop'})}, payload)}After {label}</main>;
      }`,
    });
  }
}

examples.push(
  {
    name: 'protected-content/create-element-shadowed-named',
    input: `import {createElement as create} from 'react'; export function Page({create, label}) {return <main>Before{create('style', {}, label)}After</main>;}`,
  },
  {
    name: 'protected-content/create-element-shadowed-default',
    input: `import React from 'react'; export function Page({React, label}) {return <main>Before{React.createElement('style', {}, label)}After</main>;}`,
  },
  {
    name: 'protected-content/create-element-unrelated-source',
    input: `import {createElement as create} from './custom-runtime'; export function Page({label}) {return <main>Before{create('style', {}, label)}After</main>;}`,
  },
  {
    name: 'protected-content/create-element-ordinary-component',
    input: `import {createElement as create} from 'react'; export function Page({label}) {return <main>Before{create('div', {}, label)}After</main>;}`,
  }
);
