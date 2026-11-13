import path from 'node:path';
import { expect, test } from 'vitest';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import { isSourceFile } from '../../src/compiler/languages/language.js';
import { FileSelection } from '../../src/compiler/project/files.js';
import { writeProject } from '../helpers/fixture.js';

/** Enough files for several batches, nested, ignored, excluded and not sources. */
async function project(): Promise<string> {
  const many = Object.fromEntries(
    Array.from({ length: 700 }, (_, index) => [
      `src/features/f${index % 7}/Mod${index}.ts`,
      'export {};\n',
    ])
  );

  return writeProject('files-listed', {
    ...many,
    'src/App.vue': '<template />',
    'src/auto-imports.d.ts': 'export {};\n',
    'src/notes.md': '# notes',
    'src/App.test.ts': 'export {};\n',
    'generated/out.ts': 'export {};\n',
    '.gitignore': 'generated/\n',
    'node_modules/dependency/index.js': 'export {};\n',
    'dist/bundle.js': 'export {};\n',
  });
}

const selection = (root: string, include?: string[], exclude?: string[]) =>
  new FileSelection({
    projectRoot: root,
    include,
    exclude,
    isSourceFile: (file) => isSourceFile(file, defaultLanguages),
  });

test.each([
  ['the whole project', undefined, undefined],
  ['include and exclude', ['src/features', 'src/App.vue'], ['src/features/f3']],
])(
  'files found as they are listed are the files listed: %s',
  async (_, include, exclude) => {
    const root = await project();
    const listed = await selection(root, include, exclude).list();

    const batches: string[][] = [];
    const streamed = await selection(root, include, exclude).list({
      onFiles: (files) => void batches.push(files),
    });

    expect(streamed).toEqual(listed);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat().sort()).toEqual(listed.files);
    // Selected files only, each once.
    expect(new Set(batches.flat()).size).toBe(listed.files.length);
    expect(listed.files).not.toContain(path.join(root, 'generated/out.ts'));
    expect(listed.files).not.toContain(path.join(root, 'src/App.test.ts'));
    expect(listed.files.some((file) => file.includes('node_modules'))).toBe(
      false
    );
  }
);

test('nothing listed, no batch', async () => {
  const root = await project();
  const batches: string[][] = [];
  const listed = await selection(root, ['src/missing']).list({
    onFiles: (files) => void batches.push(files),
  });

  expect(listed.files).toEqual([]);
  expect(listed.missing).toEqual([path.join(root, 'src/missing')]);
  expect(batches).toEqual([]);
});
