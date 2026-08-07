import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectVueProject } from '@generaltranslation/vue-extractor/detect';
import { GT_PARSING_FLAGS_DEFAULT } from '../../config/defaults.js';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { Libraries } from '../../types/libraries.js';
import type { ParsingConfigOptions } from '../../types/parsing.js';
import { extractInlineFromProject } from '../extractInline.js';

const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];
const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['development', 'browser', 'module', 'import', 'default'],
};

afterEach(() => {
  process.chdir(originalCwd);
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('final React/Vue ownership boundary', () => {
  it.each([
    {
      lexicalSource: `
        const fakeSfc = "<script setup>import { VueT } from '@fixture/multi/vue'; const Fake = VueT;</script>";
        void fakeSfc;
      `,
      name: 'a JavaScript string',
    },
    {
      lexicalSource: `
        const fakeSfc = \`<script setup>import { VueT } from '@fixture/multi/vue'; const Fake = VueT;</script>\`;
        void fakeSfc;
      `,
      name: 'a JavaScript template literal',
    },
    {
      lexicalSource: `
        /* <script setup>import { VueT } from '@fixture/multi/vue'; const Fake = VueT;</script> */
      `,
      name: 'a JavaScript block comment',
    },
    {
      lexicalSource: `
        // <script setup>import { VueT } from '@fixture/multi/vue'; const Fake = VueT;</script>
      `,
      name: 'a JavaScript line comment',
    },
  ])(
    'does not activate Vue for SFC-shaped text inside $name',
    async ({ lexicalSource }) => {
      createReactWrapperFixture({
        'src/Legacy.vue': `
          import { T } from 'gt-react';
          ${lexicalSource}
          export const App = () => <T>Stable legacy React message</T>;
        `,
      });

      const historical = await extractHistorical(['src/Legacy.vue']);
      const dispatched = await extractDispatched(['src/Legacy.vue']);

      expect(dispatched).toEqual(historical);
      expect(dispatched.errors).toEqual([]);
      expect(dispatched.updates.map(({ source }) => source)).toEqual([
        'Stable legacy React message',
      ]);
      expect(detectVueProject()).toBe(false);
    }
  );

  it.each([
    {
      name: 'an unused ordinary named import',
      vueSource: `<script>
        import { VueT } from '@fixture/multi/vue';
        export default {};
      </script><template><VueT /></template>`,
    },
    {
      name: 'an unused ordinary default import',
      vueSource: `<script>
        import VueT from '@fixture/multi/vue';
        export default {};
      </script><template><VueT /></template>`,
    },
    {
      name: 'an unused ordinary namespace import',
      vueSource: `<script>
        import * as Mixed from '@fixture/multi/vue';
        export default {};
      </script><template><Mixed.VueT /></template>`,
    },
    {
      name: 'a normalized tag resolved to a camel setup binding',
      vueSource: `<script setup>
        import { VueT } from '@fixture/multi/vue';
        const vueT = 'section';
      </script><template><vue-t /></template>`,
    },
    {
      name: 'a namespace tag resolved to a camel setup binding',
      vueSource: `<script setup>
        import * as Mixed from '@fixture/multi/vue';
        const mixed = { VueT: 'section' };
      </script><template><mixed.VueT /></template>`,
    },
    {
      name: 'an ordinary named import shadowed by an exact setup binding',
      vueSource: `<script>
        import { VueT as LocalT } from '@fixture/multi/vue';
        export default {};
      </script><script setup>
        const LocalT = 'section';
      </script><template><LocalT /></template>`,
    },
    {
      name: 'an ordinary default import shadowed by an exact setup binding',
      vueSource: `<script>
        import LocalT from '@fixture/multi/vue';
        export default {};
      </script><script setup>
        const LocalT = 'section';
      </script><template><LocalT /></template>`,
    },
    {
      name: 'an ordinary namespace import shadowed by an exact setup binding',
      vueSource: `<script>
        import * as Mixed from '@fixture/multi/vue';
        export default {};
      </script><script setup>
        const Mixed = { VueT: 'section' };
      </script><template><Mixed.VueT /></template>`,
    },
  ])(
    'does not let $name activate Vue during React dispatch',
    async ({ vueSource }) => {
      createReactWrapperFixture({
        'src/App.tsx': reactMessage('Stable component-boundary message'),
        'src/Unrelated.vue': vueSource,
      });

      const historical = await extractHistorical();
      const dispatched = await extractDispatched();

      expect(dispatched).toEqual(historical);
      expect(dispatched.errors).toEqual([]);
      expect(dispatched.updates.map(({ source }) => source)).toEqual([
        'Stable component-boundary message',
      ]);
      expect(detectVueProject()).toBe(false);
    }
  );

  it.each(['cjs', 'es', 'esm', 'generated', 'lib', 'lib-esm'])(
    'ignores a stale public entry in the root %s output directory',
    async (outputDirectory) => {
      createReactWrapperFixture(
        {
          [`${outputDirectory}/index.js`]: `
            import { VueT } from '@fixture/multi/vue';
            export const staleComponent = VueT;
          `,
          'src/App.tsx': reactMessage('Stable generated-boundary message'),
        },
        { main: `./${outputDirectory}/index.js` }
      );

      const historical = await extractHistorical();
      const dispatched = await extractDispatched();

      expect(dispatched).toEqual(historical);
      expect(dispatched.errors).toEqual([]);
      expect(dispatched.updates.map(({ source }) => source)).toEqual([
        'Stable generated-boundary message',
      ]);
      expect(detectVueProject()).toBe(false);
    }
  );

  it.each([
    {
      extraFile: 'src/FakeLegacy.vue',
      extraSource: `
        const fakeSfc = "<script setup>import { VueT } from '@fixture/multi/vue'; const Fake = VueT;</script>";
        export const fake = fakeSfc;
      `,
      name: 'SFC-shaped JavaScript data',
      packageFields: {},
    },
    {
      extraFile: 'lib/index.js',
      extraSource: `
        import { VueT } from '@fixture/multi/vue';
        export const staleComponent = VueT;
      `,
      name: 'a generated CommonJS entry',
      packageFields: { main: './lib/index.js' },
    },
  ])(
    'does not let $name poison an unrelated React extraction',
    async ({ extraFile, extraSource, packageFields }) => {
      createReactWrapperFixture(
        {
          [extraFile]: extraSource,
          'src/App.tsx': reactMessage('Stable poisoned-boundary message'),
          'src/Unrelated.vue': '<template><main>Ordinary SFC</main></template>',
        },
        packageFields
      );

      const historical = await extractHistorical();
      const dispatched = await extractDispatched();

      expect(dispatched).toEqual(historical);
      expect(dispatched.errors).toEqual([]);
      expect(dispatched.updates.map(({ source }) => source)).toEqual([
        'Stable poisoned-boundary message',
      ]);
      expect(detectVueProject()).toBe(false);
    }
  );

  it.each(['es', 'lib'])(
    'retains legitimate wrapper usage in a nested src/%s directory',
    async (sourceDirectory) => {
      createReactWrapperFixture({
        'src/App.tsx': reactMessage('Stable nested-lib message'),
        [`src/${sourceDirectory}/vue.ts`]: `
        import { VueT } from '@fixture/multi/vue';
        export const component = VueT;
      `,
      });

      const historical = await extractHistorical();
      const dispatched = await extractDispatched();

      expect(dispatched).toEqual(historical);
      expect(dispatched.errors).toEqual([]);
      expect(dispatched.updates.map(({ source }) => source)).toEqual([
        'Stable nested-lib message',
      ]);
      expect(detectVueProject()).toBe(true);
    }
  );

  it.each([
    {
      file: 'src/App.vue',
      name: 'a real Vue SFC',
      source: `
        <script setup>
        import { VueT } from '@fixture/multi/vue';
        </script>
        <template><VueT>Real SFC usage</VueT></template>
      `,
    },
    {
      file: 'src/Legacy.vue',
      name: 'a legacy JSX module with real runtime usage',
      source: `
        import { VueT } from '@fixture/multi/vue';
        export const View = () => <VueT>Real JSX usage</VueT>;
      `,
    },
    {
      file: 'src/ScriptOnly.vue',
      name: 'a script-only SFC with a default import',
      source: `
        <script setup>
        import VueT from '@fixture/multi/vue';
        const component = VueT;
        </script>
      `,
    },
    {
      file: 'src/NamespaceScriptOnly.vue',
      name: 'a script-only SFC with a namespace import',
      source: `
        <script setup>
        import * as Mixed from '@fixture/multi/vue';
        const component = Mixed.VueT;
        </script>
      `,
    },
  ])('continues to activate Vue for $name', ({ file, source }) => {
    createReactWrapperFixture({ [file]: source });

    expect(detectVueProject()).toBe(true);
  });
});

function createReactWrapperFixture(
  sourceFiles: Record<string, string>,
  packageFields: Record<string, unknown> = {}
): string {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: '@fixture/react-app',
      ...packageFields,
      dependencies: {
        '@fixture/multi': 'file:./vendor/multi',
        'gt-react': '*',
      },
    }),
    'vendor/multi/package.json': JSON.stringify({
      name: '@fixture/multi',
      version: '1.0.0',
      exports: { './vue': './src/vue.ts' },
      dependencies: { 'gt-vue': '*' },
    }),
    'vendor/multi/src/vue.ts':
      "export { T as VueT, T as default } from 'gt-vue';\n",
    ...sourceFiles,
  });
  const destination = path.join(root, 'node_modules/@fixture/multi');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, 'vendor/multi'), destination, 'dir');
  return root;
}

function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-final-boundary-'));
  temporaryDirectories.push(root);
  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  process.chdir(root);
  return root;
}

function extractHistorical(filePatterns?: string[]) {
  return createInlineUpdates(
    Libraries.GT_REACT,
    false,
    filePatterns,
    GT_PARSING_FLAGS_DEFAULT,
    parsingOptions
  );
}

function extractDispatched(filePatterns?: string[]) {
  return extractInlineFromProject(
    Libraries.GT_REACT,
    false,
    filePatterns,
    GT_PARSING_FLAGS_DEFAULT,
    parsingOptions
  );
}

function reactMessage(message: string): string {
  return `
    import { T } from 'gt-react';
    export const App = () => <T>${message}</T>;
  `;
}
