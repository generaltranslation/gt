import { afterEach, describe, expect, it } from 'vitest';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  removeProjectFixture,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('project alias provenance', () => {
  it('ignores an incomplete Vue alias config for React-owned source', async () => {
    const root = createFixture({
      'src/App.tsx': `
        import { useGT } from 'gt-react';
        export function App() {
          const gt = useGT();
          return <h1>{gt('React-owned message')}</h1>;
        }
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('fails closed when a direct gt-vue source shares an incomplete alias config', async () => {
    const root = createFixture({
      'src/message.ts': `
        import { msg } from 'gt-vue';
        export const message = msg('Vue-owned message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue application module aliases'
    );
  });

  it('does not infer gt-vue ownership from an unresolved GT-shaped alias', async () => {
    const root = createFixture({
      'src/App.tsx': `
        import { useGT } from '#i18n';
        export function App() {
          const gt = useGT();
          return <h1>{gt('Ordinary aliased message')}</h1>;
        }
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('does not treat an ordinary relative useGT helper as gt-vue', async () => {
    const root = createFixture({
      'src/ordinary.ts': `
        export const useGT = () => (value: string) => value;
      `,
      'src/view.ts': `
        import { useGT } from './ordinary';
        export const title = useGT()('Ordinary message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('keeps an ordinary React helper behind an incomplete alias silent', async () => {
    const root = createFixture({
      'vite.config.ts': `
        import path from 'node:path';
        const dynamicAliases = getAliases();
        export default { resolve: { alias: {
          '@app': path.resolve(__dirname, 'src/app.ts'),
          ...dynamicAliases,
        } } };
      `,
      'src/app.ts': `
        export const useGT = () => (value: string) => value;
      `,
      'src/App.tsx': `
        import { useGT } from '@app';
        export function App() {
          const gt = useGT();
          return <h1>{gt('React-owned aliased message')}</h1>;
        }
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('fails closed when an incomplete alias candidate proves gt-vue provenance', async () => {
    const root = createFixture({
      'vite.config.ts': `
        import path from 'node:path';
        const dynamicAliases = getAliases();
        export default { resolve: { alias: {
          '@i18n': path.resolve(__dirname, 'src/i18n.ts'),
          ...dynamicAliases,
        } } };
      `,
      'src/i18n.ts': "export { msg } from 'gt-vue';",
      'src/message.ts': `
        import { msg } from '@i18n';
        export const message = msg('Vue-owned aliased message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue application module aliases'
    );
  });

  it('keeps diagnostic alias candidates attached through transitive barrels', async () => {
    const root = createFixture({
      'vite.config.ts': `
        import path from 'node:path';
        export default { resolve: { alias: {
          '#runtime': path.resolve(__dirname, 'src/runtime.ts'),
          ...getAliases(),
        } } };
      `,
      'src/runtime.ts': "export { msg } from 'gt-vue';",
      'shared/barrel.ts': "export { msg as translate } from '#runtime';",
      'src/message.ts': `
        import { translate } from '../shared/barrel';
        export const message = translate('Transitive aliased message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue application module aliases'
    );
  });
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture({
    'package.json': JSON.stringify({
      name: 'alias-provenance-fixture',
      private: true,
      dependencies: {
        'gt-react': '*',
        'gt-vue': '*',
      },
    }),
    'vite.config.ts': `
      const createAliases = () => ({ '#i18n': './src/i18n' });
      export default { resolve: { alias: createAliases() } };
    `,
    ...files,
  });
  temporaryDirectories.push(root);
  return root;
}
