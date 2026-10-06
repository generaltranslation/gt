import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import createESBuildConfig from '../../config/createESBuildConfig.js';
import { createDictionaryUpdates } from '../createDictionaryUpdates.js';

vi.mock('../../../console/logging.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  displayResolvedPaths: vi.fn(),
}));

describe('createDictionaryUpdates', () => {
  let directory: string;
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('bundles a TypeScript dictionary with path aliases and server-only', async () => {
    directory = fs.mkdtempSync(path.join(tmpdir(), 'gt-dictionary-'));
    fs.mkdirSync(path.join(directory, 'lib'));
    fs.writeFileSync(
      path.join(directory, 'lib', 'greeting.ts'),
      "export const greeting: string = 'Hello';\n"
    );
    const dictionaryPath = path.join(directory, 'dictionary.ts');
    fs.writeFileSync(
      dictionaryPath,
      "import 'server-only';\nimport { greeting } from '@/lib/greeting';\nexport default { home: { title: `${greeting}, world` } };\n"
    );
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory);

    const updates = await createDictionaryUpdates(
      dictionaryPath,
      [],
      [],
      createESBuildConfig({ compilerOptions: { paths: { '@/*': ['./*'] } } })
    );
    cwd.mockRestore();

    expect(updates).toEqual([
      expect.objectContaining({
        source: 'Hello, world',
        metadata: expect.objectContaining({ id: 'home.title' }),
      }),
    ]);
  });
});
