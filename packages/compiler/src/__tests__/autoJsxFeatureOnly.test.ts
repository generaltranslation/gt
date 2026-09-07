import { describe, expect, it } from 'vitest';
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import gtUnplugin from '../index';
import { hashSource } from 'generaltranslation/id';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

const code = `import {jsx as make} from 'react/jsx-runtime';
  export const Page = () => make('p', {children: ['Hello ', name]});`;

const featureOnlyOptions = {
  enableAutoJsxInjection: true,
  disableBuildChecks: true,
  compileTimeHash: false,
  enableMacroTransform: false,
  autoderive: false,
  autoJsxImportSource: 'gt-next' as const,
  logLevel: 'silent' as const,
};

async function transform(input: string, options = featureOnlyOptions) {
  const plugin = gtUnplugin.raw(options, { framework: 'webpack' });
  if (typeof plugin.transform !== 'function')
    throw new Error('Missing transform hook');
  const context = {
    addWatchFile() {},
    emitFile() {},
    getWatchFiles: () => [],
    parse() {
      throw new Error('Unexpected parser use');
    },
    warn() {},
    error(message: unknown) {
      throw new Error(String(message));
    },
  } as UnpluginBuildContext & UnpluginContext;
  const result = await plugin.transform.call(context, input, '/input.tsx');
  return typeof result === 'string' ? result : (result?.code ?? null);
}

describe('automatic JSX as the only enabled compiler feature', () => {
  it.each([true, false])(
    'honors enableAutoJsxInjection=%s with checks and hashing disabled',
    async (enabled) => {
      const output = await transform(code, {
        ...featureOnlyOptions,
        enableAutoJsxInjection: enabled,
      });
      if (!enabled) {
        expect(output).toBeNull();
        return;
      }
      expect(output).toContain('GtInternalTranslateJsx');
      expect(output).toContain('GtInternalVar');
      expect(output).not.toContain('_hash');
    }
  );

  it.each([
    `['Sparse ', , name]`,
    `['Spread ', ...items]`,
    `['Nested ', [name, other]]`,
  ])(
    'retains automatic insertion without requiring static extraction of %s',
    async (children) => {
      const output =
        await transform(`import { jsxDEV as make } from 'react/jsx-dev-runtime';
      export const Page = () => make('p', {children: ${children}}, undefined, false);`);
      expect(output).toContain('GtInternalTranslateJsx');
      expect(output).not.toContain('_hash');
    }
  );

  it('does not discard insertion because an untouched manual T cannot be statically extracted', async () => {
    const output =
      await transform(`import { jsx as make } from 'react/jsx-runtime';
      import { T } from 'gt-next';
      export const Page = () => [make(T, {children: name}), make('p', {children: 'Visible'})];`);
    expect(output).toContain('GtInternalTranslateJsx');
    expect(output).toContain('children: name');
    expect(output).not.toContain('_hash');
  });

  it('retains existing validation when static hash generation is requested', async () => {
    const output = await transform(
      `import { jsx as make } from 'react/jsx-runtime';
      import { T } from 'gt-next';
      export const Page = () => [make(T, {children: name}), make('p', {children: 'Visible'})];`,
      { ...featureOnlyOptions, compileTimeHash: true }
    );
    expect(output).toBeNull();
  });
});

describe('automatic JSX under default checks and hash generation', () => {
  const defaults = {
    ...featureOnlyOptions,
    compileTimeHash: true,
    disableBuildChecks: false,
  };
  it.each(
    ['jsx', 'jsxs', 'jsxDEV'].flatMap((helper) => [
      { helper, children: `['Sparse ', , name]` },
      { helper, children: `['Spread ', ...items]` },
    ])
  )(
    'keeps $helper automatic $children and later manual/string hashes aligned',
    async ({ helper, children }) => {
      const source =
        helper === 'jsxDEV' ? 'react/jsx-dev-runtime' : 'react/jsx-runtime';
      const extra = helper === 'jsxDEV' ? ', undefined, false' : '';
      const input = `import {${helper} as make} from '${source}'; import {T, useGT} from 'gt-next';
      export const Page = () => [
        make(T, {children:'Before'}${extra}),
        make('p', {children:${children}}${extra}),
        make(T, {children:'After'}${extra}),
        make('p', {children:'Valid automatic'}${extra})
      ];
      const gt = useGT(); export const message = gt('String after');`;
      const output = await transform(input, defaults);
      expect(output).not.toBeNull();
      const ast = parser.parse(output!, { sourceType: 'module' });
      const manual: [string, string | undefined][] = [];
      const automatic: (string | undefined)[] = [];
      traverse(ast, {
        CallExpression(path) {
          const [component, props] = path.node.arguments;
          if (!t.isIdentifier(component) || !t.isObjectExpression(props))
            return;
          const prop = (name: string) =>
            props.properties.find(
              (property) =>
                t.isObjectProperty(property) &&
                t.isIdentifier(property.key, { name })
            );
          const hashProperty = prop('_hash');
          const hash =
            t.isObjectProperty(hashProperty) &&
            t.isStringLiteral(hashProperty.value)
              ? hashProperty.value.value
              : undefined;
          if (component.name === 'T') {
            const childProperty = prop('children');
            if (
              t.isObjectProperty(childProperty) &&
              t.isStringLiteral(childProperty.value)
            )
              manual.push([childProperty.value.value, hash]);
          }
          if (component.name === 'GtInternalTranslateJsx') automatic.push(hash);
        },
      });
      expect(manual).toEqual(
        ['Before', 'After'].map((source) => [
          source,
          hashSource({ source, dataFormat: 'JSX' }),
        ])
      );
      expect(automatic).toEqual([
        undefined,
        hashSource({ source: 'Valid automatic', dataFormat: 'JSX' }),
      ]);
      expect(output).toContain(
        hashSource({ source: 'String after', dataFormat: 'ICU' })
      );
    }
  );

  it.each([
    `make(T, {children: ['Manual sparse ', , name]})`,
    `make(T, {children: ['Manual spread ', ...items]})`,
    `make('p', {children: ['Outer ', make(T, {children: name})]})`,
  ])('keeps manual T validation intact: %s', async (element) => {
    await expect(
      transform(
        `import {jsx as make} from 'react/jsx-runtime'; import {T} from 'gt-next'; export const Page = () => ${element};`,
        defaults
      )
    ).rejects.toThrow('invalid library usage');
  });
});
