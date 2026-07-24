import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import { transformReactI18nextSource } from '../transforms/transformReactI18nextSource.js';
import { ensureNamedImports } from '../transforms/importUtils.js';
import { checkExistingGtConfig, emitGtFiles } from '../emit/emitGtFiles.js';
import { discoverReactI18nextCatalogs } from '../catalogs/reactI18nextCatalogs.js';
import { clearI18nextConfigCache } from '../config/reactI18nextConfig.js';
import { reactI18nextAdapter } from '../adapters/reactI18next.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';

// Round-8 review hardening (Ernest, 2026-07-24): every test here pins a fix
// for a finding from the code-only review of 59e417a13 (mutation safety and
// adapter edge cases).

const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(cwd = '/project'): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: { title: 'Title' }, es: {} },
    dir: path.join(cwd, 'messages'),
  };
  return {
    cwd,
    catalogs,
    routing,
    adapter: reactI18nextAdapter,
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
  };
}

const lines = (...l: string[]) => l.join('\n');

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

function makeTree(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-r8-'));
  tmpDirs.push(cwd);
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return cwd;
}

const transform = (code: string) =>
  transformReactI18nextSource('src/app/page.tsx', code, makeContext());

// ---------------------------------------------------------------------------
// P1: splitting `const { t, i18n } = useTranslation()` into two declarators
// replaced the WHOLE declaration, deleting sibling declarators in the same
// statement.
// ---------------------------------------------------------------------------

describe('useTranslation split preserves sibling declarators', () => {
  it('keeps a sibling declared before the hook destructure', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const keep = 1, { t, i18n } = useTranslation();',
        "  return <button onClick={() => i18n.changeLanguage('es')}>{t('title')}{keep}</button>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('keep = 1');
    expect(r.code).toContain('useTranslations(');
    expect(r.code).toContain('useSetLocale(');
  });

  it('keeps a sibling declared after the hook destructure', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t, i18n } = useTranslation(), keep = 1;',
        "  return <button onClick={() => i18n.changeLanguage('es')}>{t('title')}{keep}</button>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('keep = 1');
    expect(r.code).toContain('useTranslations(');
    expect(r.code).toContain('useSetLocale(');
  });

  it('keeps a sibling when only one replacement declarator is produced', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const keep = 1, { t } = useTranslation();',
        "  return <span>{t('title')}{keep}</span>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('keep = 1');
    expect(r.code).toContain('useTranslations(');
  });
});

// ---------------------------------------------------------------------------
// P2: array destructures were only read at positions 0 and 1; anything else
// (`ready` at index 2, defaults, rest elements) was silently dropped while
// its references remained.
// ---------------------------------------------------------------------------

describe('useTranslation array-pattern validation', () => {
  it('holds the file when `ready` is destructured at index 2', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const [t, i18n, ready] = useTranslation();',
        "  return ready ? <span>{t('title')}</span> : null;",
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/ready/);
  });

  it('holds the file on a default element', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'const fallback = (key: string) => key;',
        'export function C() {',
        '  const [t = fallback] = useTranslation();',
        "  return <span>{t('title')}</span>;",
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/does not preserve/);
  });

  it('holds the file on a rest element', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const [...rest] = useTranslation();',
        "  return <span>{rest[0]('title')}</span>;",
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/does not preserve/);
  });

  it('still converts a hole at position 0', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const [, i18n] = useTranslation();',
        "  return <button onClick={() => i18n.changeLanguage('es')}>x</button>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('useSetLocale(');
  });
});

// ---------------------------------------------------------------------------
// P2: ensureNamedImports merged named specifiers into ANY existing declaration
// for the module, including `import * as ns`, which is invalid syntax; and its
// presence check keyed on local names instead of the imported symbol.
// ---------------------------------------------------------------------------

describe('ensureNamedImports', () => {
  const run = (code: string, names: string[]) => {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    ensureNamedImports(ast, 'gt-next/config', names);
    const output = generate(ast).code;
    // The output must stay parseable (the namespace-merge bug produced
    // syntactically invalid code).
    parse(output, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    return output;
  };

  it('adds a separate declaration next to a namespace import', () => {
    const output = run(
      "import * as gt from 'gt-next/config';\nexport default gt.something({});",
      ['withGTConfig']
    );
    expect(output).toContain("import * as gt from 'gt-next/config'");
    expect(output).toMatch(
      /import \{ withGTConfig \} from ["']gt-next\/config["']/
    );
  });

  it('treats an aliased import of the symbol as absent and adds a plain one', () => {
    const output = run(
      "import { withGTConfig as wgc } from 'gt-next/config';",
      ['withGTConfig']
    );
    // One symbol imported twice under two locals is legal; generated code
    // references the plain name.
    expect(output).toMatch(/withGTConfig as wgc/);
    expect(output).toMatch(
      /(\{ withGTConfig as wgc, withGTConfig \}|import \{ withGTConfig \})/
    );
  });

  it('does not duplicate a plainly present symbol', () => {
    const output = run("import { withGTConfig } from 'gt-next/config';", [
      'withGTConfig',
    ]);
    expect(output.match(/withGTConfig/g)).toHaveLength(1);
  });

  it('does not redeclare a local taken by a different symbol', () => {
    const code = "import { getGT as withGTConfig } from 'gt-next/config';";
    const output = run(code, ['withGTConfig']);
    expect(output.match(/withGTConfig/g)).toHaveLength(1);
  });

  it('merges into a named declaration even when a namespace import comes first', () => {
    const output = run(
      lines(
        "import * as ns from 'gt-next/config';",
        "import { getGT } from 'gt-next/config';"
      ),
      ['withGTConfig']
    );
    expect(output).toMatch(/import \{ getGT, withGTConfig \}/);
  });
});

// ---------------------------------------------------------------------------
// P1: an existing gt.config.json that failed to read or parse was silently
// replaced with `{}` plus defaults, discarding projectId, custom files
// entries, and publish settings. Now a run-level fatal before any write.
// ---------------------------------------------------------------------------

describe('checkExistingGtConfig', () => {
  it('returns null when no config exists', () => {
    expect(checkExistingGtConfig(makeContext(makeTree({})))).toBeNull();
  });

  it('returns null for a readable JSON object', () => {
    const cwd = makeTree({
      'gt.config.json': JSON.stringify({ projectId: 'abc' }),
    });
    expect(checkExistingGtConfig(makeContext(cwd))).toBeNull();
  });

  it('reports a malformed config as a pre-write failure', () => {
    const cwd = makeTree({ 'gt.config.json': '{ projectId: broken,, }' });
    const problem = checkExistingGtConfig(makeContext(cwd));
    expect(problem).toMatch(/could not be read as a JSON object/);
    expect(problem).toMatch(/Nothing has been written/);
  });

  it('reports valid JSON that is not an object', () => {
    const cwd = makeTree({ 'gt.config.json': '["en", "es"]' });
    expect(checkExistingGtConfig(makeContext(cwd))).toMatch(
      /could not be read as a JSON object/
    );
  });

  it('honors a custom ctx.configFile path', () => {
    const cwd = makeTree({ 'config/gt.json': 'not json' });
    const ctx = makeContext(cwd);
    ctx.configFile = path.join(cwd, 'config/gt.json');
    expect(checkExistingGtConfig(ctx)).toMatch(/could not be read/);
  });

  it('emitGtFiles refuses to build a write from an unreadable config', () => {
    const cwd = makeTree({ 'gt.config.json': 'not json' });
    expect(() => emitGtFiles(makeContext(cwd))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// P2: supportedLngs entries with no catalog directory were silently dropped
// from the migrated locale set (i18next may serve them via fallback or a
// remote backend). The next-intl path already refused this narrowing.
// ---------------------------------------------------------------------------

describe('react-i18next locale narrowing', () => {
  beforeEach(() => clearI18nextConfigCache());

  const i18nConfig = lines(
    "import i18n from 'i18next';",
    "import { initReactI18next } from 'react-i18next';",
    'i18n.use(initReactI18next).init({',
    "  supportedLngs: ['en', 'es'],",
    "  fallbackLng: 'en',",
    '});',
    'export default i18n;'
  );

  it('stops when a configured locale has no catalog directory', async () => {
    const cwd = makeTree({
      'i18n.ts': i18nConfig,
      'public/locales/en/translation.json': JSON.stringify({ title: 'Title' }),
    });
    await expect(discoverReactI18nextCatalogs(cwd, routing)).rejects.toThrow(
      /no catalog for es/
    );
  });

  it('proceeds when every configured locale has a catalog', async () => {
    const cwd = makeTree({
      'i18n.ts': i18nConfig,
      'public/locales/en/translation.json': JSON.stringify({ title: 'Title' }),
      'public/locales/es/translation.json': JSON.stringify({
        title: 'Título',
      }),
    });
    const catalogs = await discoverReactI18nextCatalogs(cwd, routing);
    expect(catalogs).not.toBeNull();
    expect([...catalogs!.locales].sort()).toEqual(['en', 'es']);
  });
});
