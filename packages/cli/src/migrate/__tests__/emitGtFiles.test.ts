import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emitGtFiles } from '../emitGtFiles.js';
import type { MessageCatalogs, MigrationContext } from '../types.js';

const tmpDirs: string[] = [];

function makeProject(
  files: Record<string, string>,
  skipped: string[] = []
): MigrationContext {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-emit-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: path.join(cwd, 'messages'),
  };
  return {
    cwd,
    catalogs,
    routing: {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: path.join(cwd, 'src/i18n/routing.ts'),
      requestFile: path.join(cwd, 'src/i18n/request.ts'),
    },
    edits: [],
    todos: [],
    skippedFiles: new Map(skipped.map((file) => [file, ['reason']])),
    stats: {},
  };
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

const basePackageJson = JSON.stringify(
  {
    name: 'app',
    dependencies: { next: '15.0.0', 'next-intl': '^4.0.0', react: '19.0.0' },
  },
  null,
  2
);

describe('emitGtFiles', () => {
  it('emits gt.config.json, loadDictionary.ts, package.json edit, and deletions', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/i18n/routing.ts': '// routing',
      'src/i18n/request.ts': '// request',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));

    const config = JSON.parse(
      byPath.get(path.join(ctx.cwd, 'gt.config.json'))!.content!
    );
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['en', 'es']);
    expect(config.files.gt.output).toBe('public/_gt/[locale].json');

    const loader = byPath.get(path.join(ctx.cwd, 'src/loadDictionary.ts'))!;
    expect(loader.content).toContain('../messages/${locale}.json');
    expect(loader.content).toContain('export { loadDictionary }');

    const pkg = JSON.parse(
      byPath.get(path.join(ctx.cwd, 'package.json'))!.content!
    );
    expect(pkg.dependencies['next-intl']).toBeUndefined();
    expect(pkg.dependencies.next).toBe('15.0.0');

    expect(byPath.get(ctx.routing.routingFile!)!.kind).toBe('delete');
    expect(byPath.get(ctx.routing.requestFile!)!.kind).toBe('delete');
  });

  it('keeps next-intl and the i18n config files while skips remain', () => {
    const ctx = makeProject(
      {
        'package.json': basePackageJson,
        'src/i18n/routing.ts': '// routing',
        'src/i18n/request.ts': '// request',
        'messages/en.json': '{}',
      },
      ['src/components/Price.tsx']
    );
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));

    expect(byPath.has(ctx.routing.routingFile!)).toBe(false);
    expect(byPath.has(ctx.routing.requestFile!)).toBe(false);
    const pkgEdit = byPath.get(path.join(ctx.cwd, 'package.json'));
    if (pkgEdit) {
      const pkg = JSON.parse(pkgEdit.content!);
      expect(pkg.dependencies['next-intl']).toBeDefined();
    }
  });

  it('places loadDictionary inside src/ when the app uses a src dir', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/page.tsx': 'export {}',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const loader = edits.find((edit) => edit.path.includes('loadDictionary'))!;
    expect(loader.path).toBe(path.join(ctx.cwd, 'src/loadDictionary.ts'));
    expect(loader.content).toContain('../messages/${locale}.json');
  });

  it('merges into an existing gt.config.json', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'gt.config.json': JSON.stringify({ projectId: 'abc123' }),
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const configEdit = edits.find((edit) =>
      edit.path.endsWith('gt.config.json')
    )!;
    const config = JSON.parse(configEdit.content!);
    expect(config.projectId).toBe('abc123');
    expect(config.defaultLocale).toBe('en');
  });

  it('does not clobber an existing loadDictionary file', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'loadDictionary.ts': 'export default async function loadDictionary() {}',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(
      edits.some((edit) => edit.path.endsWith('loadDictionary.ts'))
    ).toBe(false);
    expect(ctx.todos.some((todo) => todo.reason.includes('loadDictionary'))).toBe(
      true
    );
  });
});
