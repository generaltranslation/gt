import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-modules-'));
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { force: true, recursive: true });
});

describe('local module identity resolution', () => {
  it('matches direct imports through renamed and index-barrel reexports', async () => {
    write(
      'runtime.ts',
      `export {
        T as Translate,
        Branch as Choice,
        Currency as Money,
        DateTime as DateValue,
        Num as NumberValue,
        Var as Variable,
        msg as defineMessage,
        useGT as createTranslator,
        useMessages as createMessages,
      } from 'gt-vue';`
    );
    write(
      'barrels/index.ts',
      `export {
        Translate as T,
        Choice as Branch,
        Money as Currency,
        DateValue as DateTime,
        NumberValue as Num,
        Variable as Var,
        defineMessage as msg,
        createTranslator as useGT,
        createMessages as useMessages,
      } from '../runtime.js';`
    );
    write('barrels/nested/index.ts', `export * from '..';`);

    const direct = await extract(
      'Direct.vue',
      componentSource(`from 'gt-vue'`)
    );
    const barrel = await extract(
      'Barrel.vue',
      componentSource(`from './barrels/nested'`)
    );

    expect(direct.errors).toEqual([]);
    expect(barrel.errors).toEqual([]);
    expect(comparable(barrel.results)).toEqual(comparable(direct.results));
  });

  it('resolves namespace, default, and immutable local aliases', async () => {
    write(
      'aliases.ts',
      `import { T, Branch, msg, useGT } from 'gt-vue';
       const LocalT = T;
       const LocalBranch = Branch;
       const defineMessage = msg;
       const createTranslator = useGT;
       export default LocalT;
       export { LocalBranch as Branch, defineMessage as msg, createTranslator as useGT };`
    );
    write(
      'index.ts',
      `export * from './aliases'; export { default } from './aliases';`
    );
    const output = await extract(
      'Aliases.vue',
      `<script setup lang="ts">
        import DefaultT, { Branch, msg, useGT } from './index';
        import * as Local from './index';
        const gt = useGT();
        gt('Default alias function');
        msg('Named alias message');
        Local.msg('Namespace alias message');
      </script>
      <template>
        <DefaultT context="default"><Branch branch="one"><template #one>Default rich</template></Branch></DefaultT>
        <Local.default context="namespace">Namespace rich</Local.default>
      </template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Default alias function',
      'Named alias message',
      'Namespace alias message',
      expect.any(Object),
      'Namespace rich',
    ]);
  });

  it('uses an explicit resolver for a tsconfig-style path alias', async () => {
    const barrel = write(
      'src/i18n/barrel.ts',
      `export { T as Translate, msg as defineMessage } from 'gt-vue';`
    );
    const output = await extract(
      'src/Alias.vue',
      `<script setup>
        import { Translate, defineMessage } from '@app/i18n';
        defineMessage('Aliased package message');
      </script>
      <template><Translate>Aliased package rich text</Translate></template>`,
      {
        resolveModule(specifier) {
          return specifier === '@app/i18n' ? barrel : undefined;
        },
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Aliased package message',
      'Aliased package rich text',
    ]);
  });

  it('recognizes reexported identities in TSX', async () => {
    write(
      'helper.ts',
      `export function invoke(translate) { translate('TSX forwarded'); }`
    );
    write(
      'barrel.ts',
      `export { T as Translate, msg as defineMessage, useGT as createTranslator } from 'gt-vue';
       export * as GT from 'gt-vue';
       export * as Vue from 'vue';
       export { h as render } from 'vue';
       export { invoke } from './helper';`
    );
    const output = await extract(
      'consumer.tsx',
      `import { GT, Vue, Translate, createTranslator, defineMessage, invoke, render } from './barrel';
       const gt = createTranslator();
       gt('TSX function');
       defineMessage('TSX message');
       invoke(gt);
       export const first = <Translate><Vue.Fragment>TSX rich</Vue.Fragment></Translate>;
       export const namespace = <GT.T>TSX namespace rich</GT.T>;
       export const second = render(Translate, null, 'Render rich');`
    );

    expect(output.results.map(({ source }) => source)).toEqual([
      'TSX function',
      'TSX message',
      'TSX forwarded',
      { c: 'TSX rich', i: 1, t: 'C1' },
      'TSX namespace rich',
    ]);
    expect(output.errors).toEqual([
      expect.stringContaining('Vue render function'),
    ]);
  });

  it('preserves a locally reexported renamed Fragment component in TSX', async () => {
    write(
      'fragment-barrel.ts',
      `export { T } from 'gt-vue';
       export { Fragment as VueFragment } from 'vue';`
    );
    const output = await extract(
      'renamed-fragment.tsx',
      `import { T, VueFragment } from './fragment-barrel';
       export const View = () => <T><VueFragment><b>Lost</b></VueFragment></T>;`
    );

    expect(output.results.map(({ source }) => source)).toEqual([
      {
        c: { c: 'Lost', i: 2, t: 'b' },
        i: 1,
        t: 'C1',
      },
    ]);
    expect(output.errors).toEqual([]);
  });

  it('resolves external namespace reexports for gt-vue and Vue', async () => {
    write(
      'namespaces.ts',
      `export * as GT from 'gt-vue'; export * as Vue from 'vue';`
    );
    const output = await extract(
      'namespaces.tsx',
      `import { GT, Vue } from './namespaces';
       GT.msg('Namespace export message');
       GT.useGT()('Namespace export function');
       export const fragment = Vue.Fragment;
       export const rich = Vue.h(GT.T, null, 'Namespace render');`
    );

    expect(output.results.map(({ source }) => source)).toEqual([
      'Namespace export message',
      'Namespace export function',
    ]);
    expect(output.errors).toEqual([
      expect.stringContaining('Vue render function'),
    ]);

    write(
      'namespace-aliases.ts',
      `import * as GTNamespace from 'gt-vue';
       import * as VueNamespace from 'vue';
       export { GTNamespace as GT, VueNamespace as Vue };`
    );
    const aliases = await extract(
      'namespace-aliases.tsx',
      `import { GT, Vue } from './namespace-aliases';
       GT.msg('Namespace alias message');
       export const fragment = Vue.Fragment;
       export const rich = Vue.h(GT.T, null, 'Namespace alias render');`
    );
    expect(aliases.results.map(({ source }) => source)).toEqual([
      'Namespace alias message',
    ]);
    expect(aliases.errors).toEqual([
      expect.stringContaining('Vue render function'),
    ]);

    write('gt-runtime.ts', `export * from 'gt-vue';`);
    write('vue-runtime.ts', `export * from 'vue';`);
    write(
      'local-namespaces.ts',
      `export * as GT from './gt-runtime';
       export * as Vue from './vue-runtime';`
    );
    const localNamespaces = await extract(
      'local-namespaces.tsx',
      `import { GT, Vue } from './local-namespaces';
       GT.msg('Local namespace message');
       export const fragment = Vue.Fragment;
       export const rich = Vue.h(GT.T, null, 'Local namespace render');`
    );
    expect(localNamespaces.results.map(({ source }) => source)).toEqual([
      'Local namespace message',
    ]);
    expect(localNamespaces.errors).toEqual([
      expect.stringContaining('Vue render function'),
    ]);
  });

  it('resolves a locally reexported Vue Suspense alias in an SFC template', async () => {
    write(
      'vue-builtins.ts',
      `export { Suspense as AwaitBoundary } from 'vue';
       export { T } from 'gt-vue';`
    );
    const output = await extract(
      'SuspenseAlias.vue',
      `<script setup>
        import { AwaitBoundary, T } from './vue-builtins';
      </script>
      <template>
        <T>
          <AwaitBoundary>
            <template #default><p>Loaded content</p></template>
            <template #fallback><p>Loading content</p></template>
          </AwaitBoundary>
        </T>
      </template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]?.source).toMatchObject({
      c: expect.objectContaining({ c: 'Loaded content' }),
      t: 'Suspense',
    });
  });

  it('lets the supplied resolver override competing relative build output', async () => {
    const sourceModule = write(
      'resolved/source.ts',
      `export { T } from 'gt-vue';`
    );
    write('resolved/source.js', `export const T = String;`);
    const output = await extract(
      'resolved/Consumer.vue',
      `<script setup>import { T } from './source.js';</script><template><T>Resolver source</T></template>`,
      {
        resolveModule(specifier) {
          return specifier === './source.js' ? sourceModule : undefined;
        },
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Resolver source',
    ]);
  });

  it('resolves cycles but fails closed for ambiguous and mutable exports', async () => {
    write(
      'cycle-a.ts',
      `export * from './cycle-b'; export { T } from 'gt-vue';`
    );
    write('cycle-b.ts', `export * from './cycle-a';`);
    const cycle = await extract(
      'Cycle.vue',
      `<script setup>import { T } from './cycle-b';</script><template><T>Cycle rich</T></template>`
    );
    expect(cycle.errors).toEqual([]);
    expect(cycle.results.map(({ source }) => source)).toEqual(['Cycle rich']);

    write('ambiguous-a.ts', `export { T as Shared } from 'gt-vue';`);
    write('ambiguous-b.ts', `export { Branch as Shared } from 'gt-vue';`);
    write(
      'ambiguous.ts',
      `export * from './ambiguous-a'; export * from './ambiguous-b';`
    );
    const ambiguous = await extract(
      'Ambiguous.vue',
      `<script setup>import { Shared } from './ambiguous';</script><template><Shared>Unsafe</Shared></template>`
    );
    expect(ambiguous.results).toEqual([]);
    expect(ambiguous.errors).toEqual([
      expect.stringContaining('Could not statically resolve'),
    ]);

    const ambiguousNamespace = await extract(
      'AmbiguousNamespace.vue',
      `<script setup>import * as Local from './ambiguous';</script><template><Local.Shared>Unsafe namespace</Local.Shared></template>`
    );
    expect(ambiguousNamespace.results).toEqual([]);
    expect(ambiguousNamespace.errors).toEqual([
      expect.stringContaining('Could not statically resolve'),
    ]);

    write(
      'mutable.ts',
      `import { T } from 'gt-vue';
       let Mutable = T;
       Mutable = String;
       export { Mutable };`
    );
    const mutable = await extract(
      'Mutable.vue',
      `<script setup>import { Mutable } from './mutable';</script><template><Mutable>Unsafe</Mutable></template>`
    );
    expect(mutable.results).toEqual([]);
    expect(mutable.errors).toEqual([
      expect.stringContaining('Could not statically resolve'),
    ]);
  });

  it('fails closed for an unresolved GT-shaped bare alias', async () => {
    const output = await extract(
      'Unresolved.vue',
      `<script setup>
        import { T as Translate, msg as defineMessage } from '@missing/gt';
        defineMessage('Unsafe message');
      </script>
      <template><Translate>Unsafe rich</Translate></template>`,
      { resolveModule: () => undefined }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
      expect.stringContaining('Could not statically resolve'),
    ]);
  });

  it('fails closed for dynamic, CommonJS, and local Vue module identities', async () => {
    write('barrel.ts', `export { T, msg } from 'gt-vue';`);
    write(
      'legacy.cjs',
      `const { T } = require('gt-vue'); module.exports = { T };`
    );
    write('legacy.cts', `const { msg } = require('gt-vue'); export = { msg };`);
    write('esm-looking.cjs', `export { T } from 'gt-vue';`);
    write('esm-looking.cts', `export { msg } from 'gt-vue';`);
    write('legacy-namespace.ts', `export * as Legacy from './legacy.cjs';`);
    write(
      'component.vue',
      `<script>export { T } from 'gt-vue';</script><template><div /></template>`
    );
    const dynamic = await extract(
      'Dynamic.vue',
      `<script setup>
        const GT = await import('./barrel');
        GT.msg('Dynamic message');
      </script><template><GT.T>Dynamic rich</GT.T></template>`
    );
    expect(dynamic.results).toEqual([]);
    expect(dynamic.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);

    const commonJs = await extract(
      'CommonJs.vue',
      `<script setup>import { T } from './legacy.cjs';</script><template><T>CommonJS rich</T></template>`
    );
    expect(commonJs.results).toEqual([]);
    expect(commonJs.errors).toEqual([
      expect.stringContaining('Could not statically resolve'),
    ]);

    const esmLookingCommonJs = await extract(
      'EsmLookingCommonJs.vue',
      `<script setup>import { T } from './esm-looking.cjs';</script><template><T>Unsafe ESM-looking CommonJS</T></template>`
    );
    expect(esmLookingCommonJs.results).toEqual([]);
    expect(esmLookingCommonJs.errors).toEqual([
      expect.stringContaining('Could not statically resolve'),
    ]);

    const commonJsNamespace = await extract(
      'CommonJsNamespace.vue',
      `<script setup>import { Legacy } from './legacy-namespace'; Legacy.msg('Unsafe namespace');</script><template><Legacy.T>Unsafe namespace rich</Legacy.T></template>`
    );
    expect(commonJsNamespace.results).toEqual([]);
    expect(commonJsNamespace.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
      expect.stringContaining('Could not statically resolve'),
    ]);

    const commonJsTypeScript = await extract(
      'CommonJsTypeScript.vue',
      `<script setup>import { msg } from './legacy.cts'; msg('CommonJS TypeScript');</script><template><div /></template>`
    );
    expect(commonJsTypeScript.results).toEqual([]);
    expect(commonJsTypeScript.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);

    const esmLookingCommonJsTypeScript = await extract(
      'EsmLookingCommonJsTypeScript.vue',
      `<script setup>import { msg } from './esm-looking.cts'; msg('Unsafe ESM-looking CommonJS TypeScript');</script><template><div /></template>`
    );
    expect(esmLookingCommonJsTypeScript.results).toEqual([]);
    expect(esmLookingCommonJsTypeScript.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);

    const vueModule = await extract(
      'VueModule.vue',
      `<script setup>import { T } from './component.vue';</script><template><T>Vue module rich</T></template>`
    );
    expect(vueModule.results).toEqual([]);
    expect(vueModule.errors).toEqual([
      expect.stringContaining('Could not statically resolve'),
    ]);
  });

  it('leaves an unrelated bare package component named T alone without a resolver', async () => {
    const output = await extract(
      'Ordinary.vue',
      `<script setup>import { T } from 'ordinary-ui-library';</script><template><T>Ordinary component</T></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('leaves proven ordinary local exports and namespace members alone', async () => {
    write(
      'ordinary.ts',
      `import { defineComponent } from 'vue';
       export const Button = {};
       export const Card = defineComponent({ name: 'Card' });
       export const format = (value) => String(value);`
    );
    const output = await extract(
      'OrdinaryLocal.vue',
      `<script setup>
        import { Button, Card, format } from './ordinary';
        import * as Ordinary from './ordinary';
        format('event');
      </script>
      <template>
        <Button>Button</Button>
        <Card>Card</Card>
        <Ordinary.Button>Namespaced</Ordinary.Button>
      </template>`,
      { resolveModule: () => undefined }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('leaves ordinary local exports with GT-shaped names alone', async () => {
    write(
      'ordinary-gt-names.ts',
      `export const T = String;
       export const msg = (source) => source;
       export const useGT = () => String;`
    );
    const output = await extract(
      'OrdinaryGTNames.vue',
      `<script setup>
        import { T, msg, useGT } from './ordinary-gt-names';
        import * as Ordinary from './ordinary-gt-names';
        msg('ordinary named message');
        useGT()('ordinary named hook');
        Ordinary.msg('ordinary namespace message');
        Ordinary.useGT()('ordinary namespace hook');
      </script>
      <template>
        <T>Ordinary named component</T>
        <Ordinary.T>Ordinary namespace component</Ordinary.T>
      </template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('lets an explicit ordinary export shadow a GT star reexport', async () => {
    write('shadowed.ts', `export * from 'gt-vue'; export const T = String;`);
    const output = await extract(
      'Shadowed.vue',
      `<script setup>
        import { T, msg } from './shadowed';
        msg('Unshadowed message');
      </script><template><T>Shadowed ordinary component</T></template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Unshadowed message',
    ]);
  });

  it('does not treat a static ordinary dynamic import as gt-vue', async () => {
    const output = await extract(
      'OrdinaryDynamic.vue',
      `<script setup>
        const Ordinary = await import('ordinary-ui');
        Ordinary.msg('analytics event');
      </script><template><div /></template>`,
      { resolveModule: () => undefined }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });
});

describe('translator forwarding through local functions', () => {
  it('emits a captured translator callback exactly once at its lexical call', async () => {
    const output = await extract(
      'CapturedCallback.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        const gt = useGT();
        function run(callback) { callback(); }
        run(() => gt('Captured once'));
      </script><template><div /></template>`,
      { includeSourceCodeContext: true }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Captured once',
    ]);
    expect(
      output.results[0]?.metadata.sourceCode?.['CapturedCallback.vue']?.[0]
        ?.target
    ).toContain(`gt('Captured once')`);
  });

  it('tracks positions, aliases, callback arrows, destructuring, rest, and cycles', async () => {
    const output = await extract(
      'Callbacks.vue',
      `<script setup lang="ts">
        import { msg, useGT, useMessages } from 'gt-vue';
        const gt = useGT();
        const m = useMessages();
        function positioned(_ordinary: unknown, translate: typeof gt) { translate('Positioned'); }
        const alias = positioned;
        alias(null, gt);
        function invoke(callback: (translate: typeof gt) => void, translate: typeof gt) { callback(translate); }
        invoke((translate) => translate('Callback arrow'), m);
        function destructured({ translate }: { translate: typeof gt }) { translate('Destructured'); }
        destructured({ translate: gt });
        function contextual(translate: typeof gt, context: string) { translate('Contextual', { $context: context }); }
        contextual(gt, 'Forwarded context');
        function rest(...values: unknown[]) { (values[1] as typeof gt)('Rest'); }
        rest(null, msg);
        function first(translate: typeof gt) { second(translate); }
        function second(translate: typeof gt) { translate('Chained'); if (false) first(translate); }
        first(gt);
      </script><template><div /></template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Positioned',
      'Callback arrow',
      'Destructured',
      'Contextual',
      'Rest',
      'Chained',
    ]);
    expect(
      output.results.find(({ source }) => source === 'Contextual')?.metadata
        .context
    ).toBe('Forwarded context');
  });

  it('resolves static source and context identifiers at the consuming call', async () => {
    write(
      'static-helper.ts',
      `export function invoke(translate, source, context) {
         translate(source, { $context: context });
       }`
    );
    const output = await extract(
      'StaticArguments.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        import { invoke as crossFile } from './static-helper';
        function sameFile(translate, source, context) {
          translate(source, { $context: context });
        }
        const gt = useGT();
        const sameSource = 'Same-file source';
        const sameContext = 'Same-file context';
        const crossSource = 'Cross-file source';
        const crossContext = 'Cross-file context';
        sameFile(gt, sameSource, sameContext);
        crossFile(gt, crossSource, crossContext);
      </script><template><div /></template>`
    );

    expect(output.errors).toEqual([]);
    expect(
      output.results.map(({ metadata, source }) => [source, metadata.context])
    ).toEqual([
      ['Same-file source', 'Same-file context'],
      ['Cross-file source', 'Cross-file context'],
    ]);
  });

  it('retains callbacks that are not consumed by a local forwarding helper', async () => {
    const output = await extract(
      'DeferredCallbacks.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        const gt = useGT();
        const directlyInvoked = () => gt('Direct callback');
        const returned = () => gt('Returned callback');
        const externallyRegistered = () => gt('External callback');
        function keep(callback) { return callback; }
        function ignore(_callback) {}
        ignore(directlyInvoked);
        directlyInvoked();
        keep(returned)();
        ignore(externallyRegistered);
        setTimeout(externallyRegistered, 0);
      </script><template><div /></template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Direct callback',
      'Returned callback',
      'External callback',
    ]);
  });

  it('keeps a consumed captured callback lexical without double-emitting', async () => {
    const output = await extract(
      'ConsumedCallback.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        const gt = useGT();
        const callback = () => gt('Consumed callback');
        function invoke(callback) { callback(); }
        invoke(callback);
      </script><template><div /></template>`,
      { includeSourceCodeContext: true }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Consumed callback',
    ]);
    expect(
      output.results[0]?.metadata.sourceCode?.['ConsumedCallback.vue']?.[0]
        ?.target
    ).toContain(`gt('Consumed callback')`);
  });

  it('tracks cross-file helpers and attributes metadata to the consuming call', async () => {
    write(
      'helpers/impl.ts',
      `export function invoke(translate) { translate('Cross-file function'); }
       export const invokeArrow = (translate) => translate('Cross-file arrow');
       export function invokeCallback(callback, translate) { callback(translate); }
       export function invokeObject({ translate }) { translate('Cross-file destructured'); }
       export function invokeRest(...values) { values[1]('Cross-file rest'); }
       export function invokeChain(translate) { invoke(translate); }
       export default invoke;`
    );
    write(
      'helpers/index.ts',
      `export {
         default as runDefault,
         invoke as run,
         invokeArrow as runArrow,
         invokeCallback,
         invokeChain,
         invokeObject,
         invokeRest,
       } from './impl';`
    );
    const output = await extract(
      'Consumer.vue',
      `<script setup>
        import { useGT, useMessages } from 'gt-vue';
        import { run, runArrow, runDefault, invokeCallback, invokeChain, invokeObject, invokeRest } from './helpers';
        const gt = useGT();
        const m = useMessages();
        run(gt);
        runArrow(m);
        runDefault(gt);
        invokeCallback((translate) => translate('Cross-file callback'), gt);
        invokeObject({ translate: gt });
        invokeRest(null, m);
        invokeChain(gt);
      </script><template><div /></template>`,
      { includeSourceCodeContext: true }
    );

    expect(output.results.map(({ source }) => source)).toEqual([
      'Cross-file function',
      'Cross-file arrow',
      'Cross-file function',
      'Cross-file callback',
      'Cross-file destructured',
      'Cross-file rest',
      'Cross-file function',
    ]);
    expect(output.errors).toEqual([]);
    for (const result of output.results) {
      expect(result.metadata.filePaths).toEqual(['Consumer.vue']);
      expect(result.metadata.sourceCode?.['Consumer.vue']).toEqual([
        expect.objectContaining({
          target: expect.stringMatching(/run|invoke/),
        }),
      ]);
    }
  });

  it('tracks default exported function declarations', async () => {
    write(
      'default-helper.ts',
      `export default function invoke(translate) {
         translate('Default function declaration');
       }`
    );
    const output = await extract(
      'DefaultHelper.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        import invoke from './default-helper';
        const gt = useGT();
        invoke(gt);
      </script><template><div /></template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Default function declaration',
    ]);
  });

  it('does not trust a mutated exported helper', async () => {
    write(
      'mutated-helper.ts',
      `export let invoke = (translate) => translate('Unsafe helper');
       invoke = () => undefined;`
    );
    const output = await extract(
      'MutatedHelper.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        import { invoke } from './mutated-helper';
        const gt = useGT();
        invoke(gt);
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('allows mutable ordinary helpers when no translator is passed', async () => {
    write(
      'mutable-format.ts',
      `export let format = (value) => String(value);
       format = (value) => value;`
    );
    const output = await extract(
      'MutableFormat.vue',
      `<script setup>
        import { format } from './mutable-format';
        import * as Helpers from './mutable-format';
        format('named event');
        Helpers.format('namespace event');
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('fails closed when unresolved imported helpers receive a translator', async () => {
    write(
      'unsupported-helper.vue',
      `<script>export default function invoke(_translate) {}</script><template><div /></template>`
    );
    const output = await extract(
      'UnresolvedHelpers.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        import { invoke as missingInvoke } from './missing-helper';
        import { invoke as packageInvoke } from 'unresolved-helper-package';
        import vueInvoke from './unsupported-helper.vue';
        import * as MissingHelpers from './missing-namespace';
        const gt = useGT();
        missingInvoke(gt);
        packageInvoke(gt);
        vueInvoke(gt);
        MissingHelpers.invoke(gt);
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(4);
    for (const error of output.errors) {
      expect(error).toContain('possible gt-vue string function alias');
    }
  });

  it('fails closed through immutable unresolved helper aliases', async () => {
    const output = await extract(
      'UnresolvedHelperAliases.vue',
      `<script setup lang="ts">
        import { useGT } from 'gt-vue';
        import { invoke } from './missing-helper';
        import * as Missing from './missing-namespace';
        const gt = useGT();
        const run = invoke;
        const typedRun = invoke as typeof invoke;
        const Helpers = Missing;
        const { invoke: destructuredRun } = Missing;
        run(gt);
        typedRun(gt);
        Helpers.invoke(gt);
        destructuredRun(gt);
        run({ translate: gt });
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(5);
    for (const error of output.errors) {
      expect(error).toContain('possible gt-vue string function alias');
    }
  });

  it('does not transfer unresolved-helper provenance to shadow bindings', async () => {
    const output = await extract(
      'ShadowedUnresolvedHelpers.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        import { invoke } from './missing-helper';
        import * as Missing from './missing-namespace';
        const gt = useGT();
        function withParameter(invoke) { invoke(gt); }
        function withNamespaceParameter(Missing) { Missing.invoke(gt); }
        withParameter(() => undefined);
        withNamespaceParameter({ invoke: () => undefined });
        {
          const invoke = () => undefined;
          const Missing = { invoke: () => undefined };
          invoke(gt);
          Missing.invoke(gt);
        }
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('treats an invalid ordinary barrel export only as a translator helper', async () => {
    write('invalid-helper-barrel.ts', `export { invoke } from './absent';`);
    const ordinary = await extract(
      'InvalidHelperOrdinary.vue',
      `<script setup>
        import { invoke } from './invalid-helper-barrel';
        invoke('event');
      </script><template><div /></template>`
    );
    expect(ordinary.results).toEqual([]);
    expect(ordinary.errors).toEqual([]);

    const translator = await extract(
      'InvalidHelperTranslator.vue',
      `<script setup>
        import { useGT } from 'gt-vue';
        import { invoke } from './invalid-helper-barrel';
        const gt = useGT();
        invoke(gt);
      </script><template><div /></template>`
    );
    expect(translator.results).toEqual([]);
    expect(translator.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('ignores unresolved imported helpers called with ordinary values', async () => {
    write(
      'ordinary-helper.vue',
      `<script>export default function invoke(_value) {}</script><template><div /></template>`
    );
    const output = await extract(
      'OrdinaryUnresolvedHelpers.vue',
      `<script setup>
        import { invoke as missingInvoke } from './ordinary-missing';
        import { invoke as packageInvoke } from 'ordinary-missing-package';
        import vueInvoke from './ordinary-helper.vue';
        import * as MissingHelpers from './ordinary-missing-namespace';
        missingInvoke('event');
        packageInvoke('event');
        vueInvoke('event');
        MissingHelpers.invoke('event');
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('ignores immutable unresolved helper aliases passed ordinary values', async () => {
    const output = await extract(
      'OrdinaryUnresolvedHelperAliases.vue',
      `<script setup lang="ts">
        import { invoke } from './ordinary-missing-helper';
        import * as Missing from './ordinary-missing-namespace';
        const run = invoke;
        const typedRun = invoke as typeof invoke;
        const Helpers = Missing;
        const { invoke: destructuredRun } = Missing;
        run('event');
        typedRun('event');
        Helpers.invoke('event');
        destructuredRun('event');
        run({ translate: 'event' });
      </script><template><div /></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });
});

describe('module-level t() extraction', () => {
  it('tracks direct, aliased, namespaced, forwarded, and template calls', async () => {
    const output = await extract(
      'App.vue',
      `<script setup lang="ts">
        import { t, t as translateImmediately } from 'gt-vue';
        import * as GT from 'gt-vue';

        const alias = translateImmediately as typeof translateImmediately;
        const context = 'module-level';
        const source = 'Static';
        t('Direct t', { $context: 'navigation' });
        alias(source + ' expression', { $context: context });
        GT.t('Namespace t');
        GT['t']('Computed namespace t');

        const { msg: _msg, ...runtime } = GT;

        function invoke(translate: typeof t) {
          return translate('Forwarded t', { $context: 'callback' });
        }
        invoke(t);
      </script>
      <template>
        {{ runtime.t('Namespace rest t') }}
        {{ t('Template t') }}
      </template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Direct t',
      'Static expression',
      'Namespace t',
      'Computed namespace t',
      'Forwarded t',
      'Namespace rest t',
      'Template t',
    ]);
    expect(contexts(output)).toEqual({
      'Direct t': 'navigation',
      'Forwarded t': 'callback',
      'Static expression': 'module-level',
    });
  });

  it('resolves renamed, star, and namespace reexports plus imported callbacks', async () => {
    write('runtime.ts', `export { t as translateImmediately } from 'gt-vue';`);
    write(
      'normalized.ts',
      `export { translateImmediately as t } from './runtime.js';`
    );
    write(
      'barrel.ts',
      `export { t as translateNow } from './normalized';
       export * as GT from './normalized';
       export * from './normalized';`
    );
    write(
      'callback.ts',
      `export function invoke(translate) {
         return translate('Cross-file callback', { $context: 'helper' });
       }`
    );

    const output = await extract(
      'consumer.ts',
      `import { GT, t, translateNow } from './barrel';
       import { invoke } from './callback';
       translateNow('Renamed reexport');
       t('Star reexport');
       GT.t('Namespace reexport');
       invoke(t);`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Renamed reexport',
      'Star reexport',
      'Namespace reexport',
      'Cross-file callback',
    ]);
    expect(contexts(output)).toEqual({
      'Cross-file callback': 'helper',
    });
  });

  it('supports proven CommonJS and TypeScript import-equals identities', async () => {
    const commonJS = await extract(
      'messages.cjs',
      `const { t: translate } = require('gt-vue');
       const GT = require('gt-vue');
       translate('CommonJS destructure');
       GT.t('CommonJS namespace');`
    );
    const importEquals = await extract(
      'messages.cts',
      `import GT = require('gt-vue');
       const translate = GT.t;
       translate('Import equals alias');`
    );

    expect(commonJS.errors).toEqual([]);
    expect(commonJS.results.map(({ source }) => source)).toEqual([
      'CommonJS destructure',
      'CommonJS namespace',
    ]);
    expect(importEquals.errors).toEqual([]);
    expect(importEquals.results.map(({ source }) => source)).toEqual([
      'Import equals alias',
    ]);
  });

  it('treats statically proven undefined string options as omitted', async () => {
    const output = await extract(
      'UndefinedOptions.vue',
      `<script setup>
        import { msg, t, useGT, useMessages } from 'gt-vue';

        const omitted = undefined;
        const gt = useGT();
        const messages = useMessages();

        t('t explicit undefined', undefined);
        t('t aliased undefined', omitted);
        t('t undefined context', { $context: undefined });
        gt('useGT explicit undefined', undefined);
        gt('useGT undefined context', { $context: omitted });
        msg('msg explicit undefined', undefined);
        msg(['msg array first', 'msg array second'], omitted);
        messages('useMessages explicit undefined', undefined);
        messages('useMessages undefined context', { $context: omitted });
      </script>
      <template>
        {{ t('template explicit undefined', undefined) }}
        {{ t('template undefined context', { $context: omitted }) }}
      </template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      't explicit undefined',
      't aliased undefined',
      't undefined context',
      'useGT explicit undefined',
      'useGT undefined context',
      'msg explicit undefined',
      'msg array first',
      'msg array second',
      'useMessages explicit undefined',
      'useMessages undefined context',
      'template explicit undefined',
      'template undefined context',
    ]);
    expect(output.results.every(({ metadata }) => !metadata.context)).toBe(
      true
    );
  });

  it('keeps lexically shadowed template undefined options fail-closed', async () => {
    const output = await extract(
      'ShadowedUndefined.vue',
      `<script setup>import { t } from 'gt-vue';</script>
       <template>
         {{ ((undefined) => t('Shadowed template options', undefined))(getValue()) }}
       </template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([expect.stringContaining('dynamic options')]);
  });

  it.each([
    {
      diagnostic: 'dynamic content in a gt-vue t() call',
      name: 'dynamic source',
      statement: `const source = String(Date.now()); t(source);`,
    },
    {
      diagnostic: 'dynamic options',
      name: 'non-inline options',
      statement: `const options = { $context: 'module' }; t('Options', options);`,
    },
    {
      diagnostic: 'dynamic options',
      name: 'shadowed undefined options',
      statement: `const undefined = getValue(); t('Options', undefined);`,
    },
    {
      diagnostic: 'dynamic $context',
      name: 'dynamic context',
      statement: `t('Context', { $context: String(Date.now()) });`,
    },
    {
      diagnostic: 'dynamic $context',
      name: 'shadowed undefined context',
      statement: `const undefined = getValue(); t('Context', { $context: undefined });`,
    },
    {
      diagnostic: 'unsupported gt-vue string option "$maxChars"',
      name: 'maxChars',
      statement: `t('Max chars', { $maxChars: 10 });`,
    },
    {
      diagnostic: 'unsupported gt-vue string option "$format"',
      name: 'format',
      statement: `t('Format', { $format: 'ICU' });`,
    },
    {
      diagnostic: 'unsupported gt-vue string option "$id"',
      name: 'id',
      statement: `t('Identifier', { $id: 'id' });`,
    },
    {
      diagnostic: 'unsupported arguments',
      name: 'extra argument',
      statement: `t('Extra', {}, 'argument');`,
    },
    {
      diagnostic: 'dynamic content in a gt-vue t() call',
      name: 'message array',
      statement: `t(['One', 'Two']);`,
    },
    {
      diagnostic: 'unsupported tagged template',
      name: 'tagged template',
      statement: 't`Tagged`;',
    },
  ])('rejects $name', async ({ diagnostic, statement }) => {
    const output = await extract(
      'invalid.ts',
      `import { t } from 'gt-vue'; ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(diagnostic);
  });

  it('requires proven gt-vue provenance and respects reassignment', async () => {
    write('react-runtime.ts', `export { t } from 'gt-react';`);
    const output = await extract(
      'ordinary.ts',
      `import { t as reactT } from 'gt-react';
       import { t as unknownT } from 'another-package';
       import { t as reexportedReactT } from './react-runtime';
       const t = String;
       reactT('React t');
       unknownT('Unknown t');
       reexportedReactT('Reexported React t');
       t('Local t');`
    );
    const reassigned = await extract(
      'reassigned.ts',
      `import { t } from 'gt-vue';
       let translate = t;
       translate('Before reassignment');
       translate = String;
       translate('After reassignment');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
    expect(reassigned.errors).toEqual([]);
    expect(reassigned.results.map(({ source }) => source)).toEqual([
      'Before reassignment',
    ]);
  });

  it('preserves ordinary branches and unused dynamic imports', async () => {
    const ordinary = await extract(
      'ordinary-branches.ts',
      `import { msg, useGT } from 'gt-vue';
       const box = { callable: String, condition: false };
       (box.callable || msg)('Ordinary call');
       (box.condition ? useGT : () => String)()('Ordinary translator');`
    );
    const unusedImports = await extract(
      'unused-imports.ts',
      `void import('gt-vue');
       const preload = () => import('gt-vue');
       void preload;`
    );

    expect(ordinary.results).toEqual([]);
    expect(ordinary.errors).toEqual([]);
    expect(unusedImports.results).toEqual([]);
    expect(unusedImports.errors).toEqual([]);
  });

  it('follows statically selected ordinary logical and conditional aliases', async () => {
    const output = await extract(
      'ordinary-static-branches.ts',
      `import { t } from 'gt-vue';
       function ordinary() { return String; }
       const first = String || t;
       const second = t && String;
       const third = String ?? t;
       const fourth = false && t;
       const fifth = true ? String : t;
       const sixth = false ? t : String;
       const seventh = (() => String) || t;
       const eighth = ordinary ?? t;
       const ninth = String ? Number : t;
       const tenth = {} ? String : t;
       first('String or');
       second('T and');
       third('String nullish');
       fourth('False and');
       fifth('True conditional');
       sixth('False conditional');
       seventh('Arrow or');
       eighth('Function nullish');
       ninth('Global conditional');
       tenth('Object conditional');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('extracts statically selected module t aliases', async () => {
    const output = await extract(
      'translated-static-branches.ts',
      `import { t } from 'gt-vue';
       function ordinaryCondition() {}
       const first = false || t;
       const second = t || String;
       const third = undefined ?? t;
       const fourth = true && t;
       const fifth = true ? t : String;
       const sixth = false ? String : t;
       const seventh = String && t;
       const eighth = String ? t : Number;
       const ninth = ordinaryCondition ? t : String;
       const tenth = (() => {}) ? t : String;
       first('False or');
       second('T or');
       third('Undefined nullish');
       fourth('True and');
       fifth('True conditional');
       sixth('False conditional');
       seventh('String and');
       eighth('Global condition');
       ninth('Function condition');
       tenth('Arrow condition');`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'False or',
      'T or',
      'Undefined nullish',
      'True and',
      'True conditional',
      'False conditional',
      'String and',
      'Global condition',
      'Function condition',
      'Arrow condition',
    ]);
  });

  it('keeps overridden callable methods fail-closed', async () => {
    const output = await extract(
      'overridden-callable.ts',
      `import { t } from 'gt-vue';
       function callable() {}
       callable.bind = () => false;
       const selected = callable.bind(null) || t;
       selected('Overridden bind');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('resolves nested logical aliases without repeated analysis', async () => {
    const nested = Array.from({ length: 28 }, () => 't').join(' || ');
    const output = await extract(
      'nested-logical.ts',
      `import { msg, t } from 'gt-vue';
       import { markRaw } from 'vue';
       const selected = ${nested};
       const sequenceSelected = (0, ${nested});
       const memberSelected = ({ value: ${nested} }).value;
       const wrappedSelected = markRaw(${nested});
       const messageSelected = (false || msg) || String;
       selected('Nested logical');
       sequenceSelected('Sequence nested logical');
       memberSelected('Member nested logical');
       wrappedSelected('Wrapped nested logical');
       messageSelected('Nested msg');`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual([
      'Nested logical',
      'Sequence nested logical',
      'Member nested logical',
      'Wrapped nested logical',
      'Nested msg',
    ]);
  });

  it('fails closed when a proven local t reexport becomes mutable', async () => {
    write(
      'mutable.ts',
      `import { t } from 'gt-vue';
       let translate = t;
       translate = String;
       export { translate };`
    );
    const output = await extract(
      'mutable-consumer.ts',
      `import { translate } from './mutable'; translate('Unsafe mutable t');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  function contexts(
    output: Awaited<ReturnType<typeof extractFromVueSource>>
  ): Record<string, string> {
    return Object.fromEntries(
      output.results.flatMap((result) =>
        result.metadata.context
          ? [[String(result.source), result.metadata.context]]
          : []
      )
    );
  }
});

function componentSource(moduleClause: string): string {
  return `<script setup lang="ts">
    import { Branch, Currency, DateTime, Num, T, Var, msg, useGT, useMessages } ${moduleClause};
    const gt = useGT();
    const m = useMessages();
    gt('Function text', { $context: 'function' });
    m(msg('Message text', { $context: 'message' }));
  </script>
  <template>
    <T context="rich">
      <p>Welcome <Var>Ernest</Var></p>
      <Branch branch="docs"><template #docs>Documentation</template><template #other>Other</template></Branch>
      <Num :value="2" />
      <Currency :value="12" currency="USD" />
      <DateTime :value="0" />
    </T>
  </template>`;
}

function comparable(results: Awaited<ReturnType<typeof extract>>['results']) {
  return results.map(({ dataFormat, metadata, source }) => ({
    context: metadata.context,
    dataFormat,
    source,
  }));
}

async function extract(
  relativePath: string,
  source: string,
  options: {
    includeSourceCodeContext?: boolean;
    resolveModule?: (specifier: string, importer: string) => string | undefined;
  } = {}
) {
  const filePath = write(relativePath, source);
  return extractFromVueSource(source, filePath, {
    ...options,
    projectRoot: fixtureRoot,
  });
}

function write(relativePath: string, source: string): string {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
  return filePath;
}
