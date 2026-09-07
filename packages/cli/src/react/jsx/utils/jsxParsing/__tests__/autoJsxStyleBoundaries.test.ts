import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import {
  autoInsertJsxComponents,
  ensureTAndVarImported,
} from '../autoInsertion.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

function transform(source: string) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const styles = () => {
    const found: string[] = [];
    traverse(ast, {
      JSXElement(path) {
        if (
          path.node.openingElement.attributes.some(
            (attribute) =>
              t.isJSXAttribute(attribute) &&
              t.isJSXIdentifier(attribute.name, { name: 'id' }) &&
              t.isStringLiteral(attribute.value, { value: 'payload' })
          )
        )
          found.push(generate(path.node).code);
      },
      CallExpression(path) {
        const props = path.node.arguments[1];
        if (
          t.isObjectExpression(props) &&
          props.properties.some(
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
  const aliases: Record<string, string> = {};
  ensureTAndVarImported(ast, aliases);
  autoInsertJsxComponents(ast, aliases);
  const wrappers: (t.JSXElement | t.CallExpression)[] = [];
  traverse(ast, {
    JSXElement(path) {
      if (
        t.isJSXIdentifier(path.node.openingElement.name, {
          name: 'GtInternalTranslateJsx',
        })
      )
        wrappers.push(path.node);
    },
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
  ['', 'style'],
  ["import Style from 'styled-jsx/style';", 'Style'],
  ["import { default as Style } from 'styled-jsx/style';", 'Style'],
  ["import * as styles from 'styled-jsx/style';", 'styles.default'],
] as const;

describe('automatic JSX CSS boundaries', () => {
  it.each(styleImports)(
    'preserves the CSS payload for %s %s',
    (imports, name) => {
      const result = transform(
        `${imports} const page = <${name} id="payload">{'p { color: red; }'}</${name}>;`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(0);
    }
  );

  it.each(styleImports)(
    'keeps %s %s under its original parent between text regions',
    (imports, name) => {
      const result = transform(
        `${imports} const page = <div>Before<${name} id="payload">{'p { color: red; }'}</${name}>After {label}</div>;`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(2);
      expect(
        result.wrappers.every(
          (wrapper) => !generate(wrapper).code.includes('payload')
        )
      ).toBe(true);
      expect(result.code).toContain('<GtInternalVar>{label}</GtInternalVar>');
    }
  );

  it('does not translate nested CSS or move a style-bearing section beneath T', () => {
    const result = transform(
      'const page = <main>Before<section>Inside<style jsx id="payload">{`p { color: ${color}; }`}</style>Tail {label}</section>After</main>;'
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(4);
    expect(
      result.wrappers.every(
        (wrapper) => !generate(wrapper).code.includes('payload')
      )
    ).toBe(true);
  });

  it('preserves adjacent styles and leading or trailing style positions', () => {
    const result = transform(
      'const page = <><style id="payload">{"a{}"}</style>Middle<style>{"b{}"}</style><style>{"c{}"}</style>End<style>{"d{}"}</style></>;'
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(2);
  });

  it('protects the entire CSS payload including otherwise translatable expressions', () => {
    const result = transform(
      'const page = <style id="payload" data-example={<i>Attribute example</i>}>{makeCss(() => <b>Payload example</b>)}</style>;'
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(0);
  });

  it.each([
    "import Style from './ordinary-style'; const page = <Style>Ordinary text</Style>;",
    "import { Style } from 'styled-jsx/style'; const page = <Style>Ordinary text</Style>;",
    "import Style from 'styled-jsx/style'; function render(Style) { return <Style>Shadowed text</Style>; }",
    "import * as styles from 'styled-jsx/style'; function render(styles) { return <styles.default>Shadowed text</styles.default>; }",
    'const page = <styleguide>Ordinary text</styleguide>;',
  ])(
    'preserves insertion for unrelated or shadowed components: %s',
    (source) => {
      expect(transform(source).wrappers).toHaveLength(1);
    }
  );

  it('continues to translate ordinary JSX beside a CSS-only child', () => {
    const result = transform(
      'const page = <main><style id="payload">{"p{}"}</style><p>Hello {label}</p></main>;'
    );
    expect(result.after).toEqual(result.before);
    expect(result.wrappers).toHaveLength(1);
    expect(result.code).toContain('Hello');
  });
});

describe('CLI raw-text host content boundaries', () => {
  it.each(['title', 'textarea', 'script'])(
    'keeps %s payloads unchanged',
    (tag) => {
      const result = transform(
        `const page = <${tag} id="payload">Original text payload</${tag}>;`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(0);
    }
  );

  it.each(['title', 'textarea', 'script'])(
    'keeps %s outside surrounding translation regions',
    (tag) => {
      const result = transform(
        `const page = <div>Before<${tag} id="payload">{payload}</${tag}>After {label}</div>;`
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
        transform(`const page = <${tag}>Ordinary text</${tag}>;`).wrappers
      ).toHaveLength(1);
    }
  );
});

describe('CLI protected runtime calls', () => {
  it.each(['style', 'script', 'title', 'textarea'])(
    'protects a lowered %s payload',
    (tag) => {
      const result = transform(
        `import {jsx as h, jsxs as hs} from 'react/jsx-runtime'; hs('main',{children:['Before', h('${tag}',{id:'payload', children:h('b',{children:'Untouched payload'})}), 'After ', label]});`
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

  it.each([
    ["import { createElement as create } from 'react';", 'create'],
    ["import React from 'react';", 'React.createElement'],
    ["import * as React from 'react';", 'React.createElement'],
    ["import * as React from 'react';", 'React["createElement"]'],
    ["import { default as React } from 'react';", 'React.createElement'],
  ])('protects the whole payload of bound %s %s', (imports, factory) => {
    for (const tag of ['style', 'script', 'title', 'textarea']) {
      const result = transform(
        `${imports} import {jsx as h} from 'react/jsx-runtime'; const page = <main>Before{${factory}('${tag}', {id:'payload', 'data-content':h('b',{children:'Untouched prop'})}, h('i',{children:'Untouched payload'}))}After {label}</main>;`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(2);
      expect(
        result.wrappers.every(
          (wrapper) => !generate(wrapper).code.includes('payload')
        )
      ).toBe(true);
    }
  });

  it.each(['style', 'script', 'title', 'textarea'])(
    'preserves the key-after-spread %s source',
    (tag) => {
      const result = transform(
        `const page = <main>Before<${tag} id="payload" {...props} key={id}>{content}</${tag}>After {label}</main>;`
      );
      expect(result.after).toEqual(result.before);
      expect(result.wrappers).toHaveLength(2);
    }
  );

  it.each(['@emotion/react/jsx-runtime', './custom/jsx-dev-runtime'])(
    'protects content lowered by %s without inserting into its ordinary elements',
    (source) => {
      for (const tag of ['style', 'script', 'title', 'textarea']) {
        const result = transform(
          `import {jsx as h, jsxs as hs} from 'react/jsx-runtime'; import {jsx as custom} from '${source}'; hs('main',{children:['Before',custom('${tag}',{id:'payload',children:h('b',{children:'Untouched payload'})}),'After']}); custom('p',{children:'Ordinary custom text'});`
        );
        expect(result.after).toEqual(result.before);
        expect(result.wrappers).toHaveLength(2);
      }
    }
  );
});
