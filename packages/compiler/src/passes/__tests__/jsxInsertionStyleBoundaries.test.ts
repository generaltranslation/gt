import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { initializeState } from '../../state/utils/initializeState';

function transform(source: string) {
  const ast = parse(
    `import { jsx as h, jsxs as hs } from 'react/jsx-runtime'; ${source}`,
    { sourceType: 'module' }
  );
  const styles = () => {
    const found: string[] = [];
    traverse(ast, {
      CallExpression(path) {
        const attributes = path.node.arguments[1];
        if (
          t.isObjectExpression(attributes) &&
          attributes.properties.some(
            (property) =>
              t.isObjectProperty(property) &&
              t.isIdentifier(property.key, { name: 'id' }) &&
              t.isStringLiteral(property.value, { value: 'payload' })
          )
        )
          found.push(generate(path.node).code);
      },
    });
    return found;
  };
  const before = styles();
  traverse(
    ast,
    jsxInsertionPass(
      initializeState({ enableAutoJsxInjection: true }, 'style.jsx')
    )
  );
  const wrappers: t.CallExpression[] = [];
  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.arguments[0], {
          name: 'GtInternalTranslateJsx',
        })
      )
        wrappers.push(path.node);
    },
  });
  return { code: generate(ast).code, before, after: styles(), wrappers };
}

const styleImports = [
  ['', '"style"'],
  ["import Style from 'styled-jsx/style';", 'Style'],
  ["import { default as Style } from 'styled-jsx/style';", 'Style'],
  ["import * as styles from 'styled-jsx/style';", 'styles.default'],
  ["import * as styles from 'styled-jsx/style';", 'styles["default"]'],
] as const;

describe('compiler automatic JSX CSS boundaries', () => {
  it.each(styleImports)('preserves CSS payloads for %s %s', (imports, name) => {
    const result = transform(
      `${imports} h(${name}, { id: 'payload', children: 'p { color: red; }' });`
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(0);
  });

  it.each(styleImports)(
    'keeps %s %s at its original parent between text regions',
    (imports, name) => {
      const result = transform(
        `${imports} hs('div', { children: ['Before', h(${name}, { id: 'payload', children: 'p { color: red; }' }), 'After ', label] });`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(2);
      expect(
        result.wrappers.every(
          (wrapper) => !generate(wrapper).code.includes('payload')
        )
      ).toBe(true);
      expect(result.code).toContain('hs(GtInternalTranslateJsx');
    }
  );

  it('keeps nested style-bearing sections outside automatic text regions', () => {
    const result = transform(
      `hs('main', { children: ['Before', hs('section', { children: ['Inside', h('style', { id: 'payload', children: css }), 'Tail ', label] }), 'After'] });`
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(4);
    expect(
      result.wrappers.every(
        (wrapper) => !generate(wrapper).code.includes('payload')
      )
    ).toBe(true);
  });

  it('preserves adjacent CSS and dynamic-only segments', () => {
    const result = transform(
      `h('div', { children: [h('style', { id: 'payload', children: 'a{}' }), 'Middle', h('style', { children: 'b{}' }), h('style', { children: 'c{}' }), label] });`
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(1);
    expect(result.code).not.toContain('h(GtInternalVar');
  });

  it('preserves holes and spreads while wrapping a multi-value text region', () => {
    const result = transform(
      `h('div', { children: ['Before', , ...values, h('style', { id: 'payload', children: css }), 'After'] });`
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(2);
    const content = result.wrappers.find(
      (node) =>
        t.isObjectExpression(node.arguments[1]) &&
        generate(node).code.includes('...values')
    )!;
    const properties = (content.arguments[1] as t.ObjectExpression).properties;
    const children = (properties[0] as t.ObjectProperty)
      .value as t.ArrayExpression;
    expect(children.elements[1]).toBeNull();
    expect(t.isSpreadElement(children.elements[2])).toBe(true);
  });

  it('protects the whole CSS payload, including nested React calls', () => {
    const result = transform(
      `h('style', { id: 'payload', 'data-example': h('i', { children: 'Attribute example' }), children: makeCss(() => h('b', { children: 'Payload example' })) });`
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(0);
  });

  it.each([
    "import Style from './ordinary-style'; h(Style, { children: 'Ordinary text' });",
    "import { Style } from 'styled-jsx/style'; h(Style, { children: 'Ordinary text' });",
    "import Style from 'styled-jsx/style'; function render(Style) { return h(Style, { children: 'Shadowed text' }); }",
    "import * as styles from 'styled-jsx/style'; function render(styles) { return h(styles.default, { children: 'Shadowed text' }); }",
    "h('styleguide', { children: 'Ordinary text' });",
  ])(
    'preserves insertion for unrelated or shadowed components: %s',
    (source) => {
      expect(transform(source).wrappers).toHaveLength(1);
    }
  );
});

describe('compiler raw-text host content boundaries', () => {
  it.each(['title', 'textarea', 'script'])(
    'keeps %s payloads unchanged',
    (tag) => {
      const result = transform(
        `h('${tag}', { id: 'payload', children: 'Original text payload' });`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(0);
    }
  );

  it.each(['title', 'textarea', 'script'])(
    'keeps %s outside surrounding translation regions',
    (tag) => {
      const result = transform(
        `hs('div', {children: ['Before', h('${tag}', { id: 'payload', children: payload }), 'After ', label]});`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(2);
      expect(
        result.wrappers.every(
          (wrapper) => !generate(wrapper).code.includes('payload')
        )
      ).toBe(true);
    }
  );

  it.each(['Title', 'Textarea', 'Script'])(
    'does not exclude an ordinary %s component',
    (tag) => {
      expect(
        transform(`h(${tag}, {children:'Ordinary text'});`).wrappers
      ).toHaveLength(1);
    }
  );
});

describe('protected createElement fallbacks', () => {
  const factories = [
    ["import { createElement as create } from 'react';", 'create'],
    ["import React from 'react';", 'React.createElement'],
    ["import * as React from 'react';", 'React.createElement'],
    ["import * as React from 'react';", 'React["createElement"]'],
    ["import { default as React } from 'react';", 'React.createElement'],
  ] as const;

  it.each(factories)(
    'preserves bound %s %s payloads and parents',
    (imports, factory) => {
      for (const tag of ['style', 'script', 'title', 'textarea']) {
        const result = transform(
          `${imports} hs('main', { children: ['Before', ${factory}('${tag}', { id: 'payload', key: id, 'data-content': h('b', {children:'Untouched prop'}) }, h('i', {children:'Untouched payload'})), 'After ', label] });`
        );
        expect(result.after).toEqual(result.before);
        expect(result.wrappers).toHaveLength(2);
        expect(
          result.wrappers.every(
            (wrapper) => !generate(wrapper).code.includes('payload')
          )
        ).toBe(true);
      }
    }
  );

  it('protects a bound styled-jsx component in a fallback call', () => {
    const result = transform(
      `import {createElement as create} from 'react'; import Style from 'styled-jsx/style'; hs('main', {children:['Before', create(Style, {id:'payload'}, h('i',{children:'Untouched payload'})), 'After']});`
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(2);
  });

  it.each([
    "import {createElement as create} from 'react'; function page(create) { return hs('main', {children:['Before', create('style', {}), 'After']}); }",
    "import React from 'react'; function page(React) { return hs('main', {children:['Before', React.createElement('style', {}), 'After']}); }",
    "import {createElement as create} from './custom'; hs('main', {children:['Before', create('style', {}), 'After']});",
    "import {createElement as create} from 'react'; hs('main', {children:['Before', create('div', {}), 'After']});",
  ])(
    'retains ordinary insertion for shadowed or unrelated factories: %s',
    (source) => {
      expect(transform(source).wrappers).toHaveLength(1);
    }
  );
});

describe('protected content lowered by another JSX runtime', () => {
  it.each(['@emotion/react/jsx-runtime', './custom/jsx-dev-runtime'])(
    'preserves protected %s calls without changing ordinary custom elements',
    (source) => {
      for (const tag of ['style', 'script', 'title', 'textarea']) {
        const result = transform(
          `import {jsx as custom} from '${source}'; hs('main', {children:['Before', custom('${tag}', {id:'payload',children:h('b',{children:'Untouched payload'})}), 'After']}); custom('p',{children:'Ordinary custom text'});`
        );
        expect(result.after).toEqual(result.before);
        expect(result.wrappers).toHaveLength(2);
        expect(
          result.wrappers.every(
            (wrapper) => !generate(wrapper).code.includes('payload')
          )
        ).toBe(true);
      }
    }
  );

  it.each([
    "import {jsx as custom} from '@emotion/react/jsx-runtime-extra'; hs('main',{children:['Before',custom('style',{}),'After']});",
    "import {jsx as custom} from '@emotion/react/jsx-runtime'; function page(custom) {return hs('main',{children:['Before',custom('style',{}),'After']});}",
    "import {other as custom} from '@emotion/react/jsx-runtime'; hs('main',{children:['Before',custom('style',{}),'After']});",
  ])('does not protect a runtime lookalike: %s', (source) => {
    expect(transform(source).wrappers).toHaveLength(1);
  });
});
