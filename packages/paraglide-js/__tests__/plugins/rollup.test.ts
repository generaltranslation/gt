import path from 'node:path';
import { expect, test } from 'vitest';
import { rollup } from 'rollup';
import { paraglideContextRollup } from '../../lib/compiler/plugins/rollup.js';
import {
  greetingIn,
  readSnippets,
  useGreeting,
  writeProject,
} from './fixture.js';

test('rollup: bundled and unbundled files, aliases from resolveId plugins', async () => {
  const root = await writeProject('rollup', {
    'src/main.js': `import { text } from "./bundled.js";\nconsole.log(text);\n`,
    'src/bundled.js': useGreeting('~/paraglide/messages.js'),
    'src/other.js': useGreeting('./paraglide/messages.js'),
  });
  const alias = {
    name: 'alias',
    resolveId(id: string) {
      return id.startsWith('~/') ? path.join(root, 'src', id.slice(2)) : null;
    },
  };
  const bundle = await rollup({
    input: path.join(root, 'src/main.js'),
    plugins: [alias, paraglideContextRollup({ root, enabled: true }) as never],
    onwarn: () => {},
  });
  await bundle.generate({ format: 'es' });
  await bundle.close();
  expect(await readSnippets(root)).toEqual([
    greetingIn('src/bundled.js'),
    greetingIn('src/other.js'),
  ]);
});
