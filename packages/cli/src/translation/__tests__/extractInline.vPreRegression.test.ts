import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GT_PARSING_FLAGS_DEFAULT } from '../../config/defaults.js';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { Libraries } from '../../types/libraries.js';
import type { ParsingConfigOptions } from '../../types/parsing.js';
import { detectVueProject } from '@generaltranslation/vue-extractor/detect';
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

describe('React extraction with v-pre Vue-like content', () => {
  it.each([
    {
      name: 'a namespace component tag',
      template: '<section v-pre><Mixed.VueT /></section>',
    },
    {
      name: 'a directive expression',
      template: '<section v-pre :title="Mixed.VueT" />',
    },
    {
      name: 'an interpolation',
      template: '<section v-pre>{{ Mixed.VueT }}</section>',
    },
    {
      name: 'a v-pre modifier',
      template: '<section v-pre.example><Mixed.VueT /></section>',
    },
    {
      name: 'a v-pre argument',
      template: '<section v-pre:example><Mixed.VueT /></section>',
    },
    {
      name: 'an uppercase component that resembles a void element',
      template: '<INPUT v-pre :value="Mixed.VueT"><Mixed.VueT /></INPUT>',
    },
  ])('preserves historical React dispatch for $name', async ({ template }) => {
    createFixture(template);

    const historical = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    const dispatched = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(dispatched).toEqual(historical);
    expect(detectVueProject()).toBe(false);
    expect(dispatched.errors).toEqual([]);
    expect(dispatched.updates.map(({ source }) => source)).toEqual([
      'Stable React message',
    ]);
  });
});

function createFixture(template: string): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cli-v-pre-'));
  temporaryDirectories.push(root);
  const files = {
    'package.json': JSON.stringify({
      name: '@fixture/react-app',
      dependencies: {
        '@fixture/multi': 'file:./vendor/multi',
        'gt-react': '*',
      },
    }),
    'src/App.tsx': `
      import { T } from 'gt-react';
      export const App = () => <T>Stable React message</T>;
    `,
    'src/Unrelated.vue': `
      <script setup>
      import * as Mixed from '@fixture/multi/vue';
      </script>
      <template>${template}</template>
    `,
    'vendor/multi/package.json': JSON.stringify({
      name: '@fixture/multi',
      version: '1.0.0',
      exports: { './vue': './src/vue.ts' },
      dependencies: { 'gt-vue': '*' },
    }),
    'vendor/multi/src/vue.ts': "export { T as VueT } from 'gt-vue';\n",
  };
  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  const destination = path.join(root, 'node_modules', '@fixture', 'multi');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, 'vendor/multi'), destination, 'dir');
  process.chdir(root);
}
