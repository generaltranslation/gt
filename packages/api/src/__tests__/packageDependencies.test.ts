import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function findTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(directory, file));
}

describe('@generaltranslation/api dependencies', () => {
  it('has no workspace dependencies', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as Record<string, unknown>;
    const workspaceDependencies = Object.entries(packageJson).flatMap(
      ([section, value]) =>
        section.toLowerCase().endsWith('dependencies') &&
        value &&
        typeof value === 'object'
          ? Object.entries(value).filter(
              ([, version]) =>
                typeof version === 'string' && version.startsWith('workspace:')
            )
          : []
    );

    expect(workspaceDependencies).toEqual([]);
  });

  it('does not import workspace packages from source', () => {
    const workspaceImportPattern =
      /from '(?:generaltranslation|@generaltranslation\/(?!api)|gt-)/;
    const workspaceImports = findTypeScriptFiles(
      join(packageRoot, 'src')
    ).filter((file) => workspaceImportPattern.test(readFileSync(file, 'utf8')));

    expect(workspaceImports).toEqual([]);
  });
});
