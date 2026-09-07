import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { initializeState } from '../../state/utils/initializeState';

type Element = {
  kind: string;
  type: string;
  props: { children: Element | (Element | string)[] | string };
  staticChildren: boolean;
};

function transform(source: string): t.File {
  const ast = parse(source, { sourceType: 'module' });
  traverse(
    ast,
    jsxInsertionPass(
      initializeState(
        { enableAutoJsxInjection: true, autoJsxImportSource: 'gt-next' },
        'input.tsx'
      )
    )
  );
  return ast;
}

/** Execute every generated binding; an unbound helper cannot pass a tree assertion. */
function execute(source: string): Element | Element[] {
  const ast = transform(source);
  ast.program.body = ast.program.body.map((statement) => {
    if (t.isImportDeclaration(statement)) {
      return t.variableDeclaration('const', [
        t.variableDeclarator(
          t.objectPattern(
            statement.specifiers.map((specifier) => {
              if (!t.isImportSpecifier(specifier))
                throw new Error('This test only uses named imports');
              return t.objectProperty(specifier.imported, specifier.local);
            })
          ),
          t.memberExpression(
            t.identifier('modules'),
            t.stringLiteral(statement.source.value),
            true
          )
        ),
      ]);
    }
    return statement;
  });
  const runtime =
    (kind: string) =>
    (
      type: string,
      props: Element['props'],
      _key?: unknown,
      flag?: boolean
    ) => ({
      kind,
      type,
      props,
      staticChildren: kind === 'jsxDEV' ? flag : kind === 'jsxs',
    });
  return runInNewContext(`${generate(ast).code}\nPage();`, {
    modules: {
      'react/jsx-runtime': { jsx: runtime('jsx'), jsxs: runtime('jsxs') },
      'react/jsx-dev-runtime': { jsxDEV: runtime('jsxDEV') },
      'gt-next': { GtInternalTranslateJsx: 'T', GtInternalVar: 'Var' },
    },
  }) as Element | Element[];
}

function one(source: string): Element {
  return execute(source) as Element;
}

describe('automatic JSX runtime helper bindings', () => {
  it.each([
    '["Hello"]',
    '["Hello ", name]',
    '["Hello ", , name]',
    '["Hello ", ...[name]]',
    '["Hello ", [name]]',
  ])('imports a bound static helper for an explicit array: %s', (children) => {
    const result = one(`import {jsx as make} from 'react/jsx-runtime';
      const name = 'Ada'; function Page() { return make('p', {children: ${children}}); }`);
    expect(result.kind).toBe('jsx');
    expect(result.props.children).toMatchObject({
      type: 'T',
      kind: 'jsxs',
      staticChildren: true,
    });
  });

  it('imports single helpers when the original module only used jsxs', () => {
    const result = one(`import {jsxs as many} from 'react/jsx-runtime';
      function Page() { const name = 'Ada'; return many('p', {children: ['Hi ', name]}); }`);
    expect(result.kind).toBe('jsx');
    const translation = result.props.children as Element;
    expect(translation.kind).toBe('jsxs');
    expect((translation.props.children as Element[])[1]).toMatchObject({
      type: 'Var',
      kind: 'jsx',
    });
  });

  it('does not capture a local helper name when adding an import', () => {
    const result = one(`import {jsx as make} from 'react/jsx-runtime';
      const jsxs = 'user'; const _jsxs = 'also user';
      function Page() { return make('p', {children: ['Hello ', jsxs, _jsxs]}); }`);
    expect((result.props.children as Element).kind).toBe('jsxs');
  });

  it('avoids reusing a helper shadowed in the insertion scope', () => {
    const result =
      one(`import {jsx as make, jsxs as many} from 'react/jsx-runtime';
      function Page() { return ((many) => make('p', {children: ['Hello ', many]}))('Ada'); }`);
    expect((result.props.children as Element).kind).toBe('jsxs');
  });

  it.each([false, true])(
    "chooses each call's runtime in a mixed module, dev first=%s",
    (first) => {
      const imports = [
        "import {jsx as make} from 'react/jsx-runtime';",
        "import {jsxDEV as dev} from 'react/jsx-dev-runtime';",
      ];
      if (first) imports.reverse();
      const result = execute(`${imports.join('\n')}
      const name = 'Ada'; function Page() { return [
        make('p', {children: ['Production ', name]}),
        dev('p', {children: ['Development ', name]}, undefined, false)
      ]; }`) as Element[];
      expect(result[0].kind).toBe('jsx');
      expect(result[0].props.children).toMatchObject({
        kind: 'jsxs',
        staticChildren: true,
      });
      expect(result[1].kind).toBe('jsxDEV');
      expect(result[1].props.children).toMatchObject({
        kind: 'jsxDEV',
        staticChildren: true,
      });
    }
  );

  it('does not add a runtime import when no translation is inserted', () => {
    const ast = transform(
      "import {jsx as make} from 'react/jsx-runtime'; function Page() { return make('p', {children: 42}); }"
    );
    const imports = ast.program.body.filter(t.isImportDeclaration);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifiers).toHaveLength(1);
  });

  it('preserves user references to the original helper', () => {
    const ast = transform(
      "import {jsxs as many} from 'react/jsx-runtime'; export const original = many; function Page() { return many('p', {children: ['Hello ', name]}); }"
    );
    expect(generate(ast).code).toContain('export const original = many;');
  });
});
