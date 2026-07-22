import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverReactIntlCatalogs } from '../adapters/reactIntlCatalogs.js';
import type { RoutingInfo } from '../pipeline/types.js';

const routing: RoutingInfo = {
  locales: null,
  defaultLocale: null,
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

const tmpDirs: string[] = [];

function makeDir(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-rintl-cat-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe('discoverReactIntlCatalogs', () => {
  it('reads flat {id: ICU} catalogs and picks en as default', async () => {
    const cwd = makeDir({
      'messages/en.json': JSON.stringify({ title: 'Welcome', hi: 'Hi {name}' }),
      'messages/fr.json': JSON.stringify({
        title: 'Bienvenue',
        hi: 'Salut {name}',
      }),
    });
    const catalogs = await discoverReactIntlCatalogs(cwd, routing);
    expect(catalogs).not.toBeNull();
    expect(catalogs!.defaultLocale).toBe('en');
    expect(catalogs!.locales.sort()).toEqual(['en', 'fr']);
    expect(catalogs!.byLocale.en.title).toBe('Welcome');
    expect(catalogs!.byLocale.fr.hi).toBe('Salut {name}');
    expect(catalogs!.filesToEmit).toBeUndefined();
  });

  it('reads the extracted/authoring shape via .defaultMessage', async () => {
    const cwd = makeDir({
      'messages/en.json': JSON.stringify({
        title: { defaultMessage: 'Welcome', description: 'the heading' },
      }),
    });
    const catalogs = await discoverReactIntlCatalogs(cwd, routing);
    expect(catalogs!.byLocale.en.title).toBe('Welcome');
  });

  it('throws on an AST-compiled (--ast) catalog', async () => {
    const cwd = makeDir({
      'messages/en.json': JSON.stringify({
        title: [{ type: 0, value: 'Welcome' }],
      }),
    });
    await expect(discoverReactIntlCatalogs(cwd, routing)).rejects.toThrow(
      /AST-compiled|--ast/
    );
  });

  it('prefers a declared defaultLocale over the alphabetical default', async () => {
    const cwd = makeDir({
      'messages/de.json': JSON.stringify({ title: 'Willkommen' }),
      'messages/fr.json': JSON.stringify({ title: 'Bienvenue' }),
      'src/Provider.tsx': [
        "'use client';",
        "import { IntlProvider } from 'react-intl';",
        'export function P({ children }: any) {',
        '  return <IntlProvider locale="de" defaultLocale="de">{children}</IntlProvider>;',
        '}',
      ].join('\n'),
    });
    const catalogs = await discoverReactIntlCatalogs(cwd, routing);
    expect(catalogs!.defaultLocale).toBe('de');
    expect(catalogs!.filesToEmit).toBeUndefined();
  });

  describe('case b2: no default-locale catalog', () => {
    it('synthesizes the default catalog from harvested defaultMessages', async () => {
      const cwd = makeDir({
        // only fr is compiled; en is served from inline defaultMessage.
        'messages/fr.json': JSON.stringify({
          title: 'Bienvenue',
          greeting: 'Salut {name}',
        }),
        'src/Provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ locale, children }: any) {',
          '  return <IntlProvider locale={locale} defaultLocale="en">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/Client.tsx': [
          "'use client';",
          "import { useIntl, FormattedMessage } from 'react-intl';",
          'export function C() {',
          '  const intl = useIntl();',
          '  return (',
          '    <>',
          "      <h1>{intl.formatMessage({ id: 'title', defaultMessage: 'Welcome' })}</h1>",
          '      <p><FormattedMessage id="greeting" defaultMessage="Hello {name}" values={{ name: "Ada" }} /></p>',
          '    </>',
          '  );',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.defaultLocale).toBe('en');
      expect(catalogs!.locales.sort()).toEqual(['en', 'fr']);
      // harvested source entries seed the default dictionary (no runtime throw).
      expect(catalogs!.byLocale.en.title).toBe('Welcome');
      expect(catalogs!.byLocale.en.greeting).toBe('Hello {name}');
      // fr translations preserved verbatim.
      expect(catalogs!.byLocale.fr.title).toBe('Bienvenue');
      // the synthesized catalog is queued as a NEW file, not a mutation.
      expect(catalogs!.filesToEmit).toHaveLength(1);
      const emit = catalogs!.filesToEmit![0];
      expect(emit.kind).toBe('write');
      expect(emit.path).toBe(path.join(cwd, 'messages', 'en.json'));
      expect(JSON.parse(emit.content!)).toMatchObject({
        title: 'Welcome',
        greeting: 'Hello {name}',
      });
      // the existing fr.json is never queued for rewrite.
      expect(
        catalogs!.filesToEmit!.some((e) => e.path.endsWith('fr.json'))
      ).toBe(false);
    });

    it('harvests aliased FormattedMessage and defineMessages imports', async () => {
      // The transform resolves react-intl locals alias-aware; the harvest must
      // too, or an aliased component is rewritten while its defaultMessage
      // never reaches the synthesized catalog (a missing key at runtime).
      const cwd = makeDir({
        'messages/fr.json': JSON.stringify({
          title: 'Bienvenue',
          greeting: 'Salut {name}',
        }),
        'src/Provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ locale, children }: any) {',
          '  return <IntlProvider locale={locale} defaultLocale="en">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/Client.tsx': [
          "'use client';",
          "import { FormattedMessage as FM, defineMessages as dm } from 'react-intl';",
          'const messages = dm({',
          "  title: { id: 'title', defaultMessage: 'Welcome' },",
          '});',
          'export function C() {',
          '  return <p><FM id="greeting" defaultMessage="Hello {name}" values={{ name: "Ada" }} /></p>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.byLocale.en.greeting).toBe('Hello {name}');
      expect(catalogs!.byLocale.en.title).toBe('Welcome');
    });

    it('throws when no defaultMessage can seed the default catalog', async () => {
      const cwd = makeDir({
        'messages/fr.json': JSON.stringify({ title: 'Bienvenue' }),
        'src/Provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ locale, children }: any) {',
          '  return <IntlProvider locale={locale} defaultLocale="en">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/Client.tsx': [
          "'use client';",
          "import { FormattedMessage } from 'react-intl';",
          'export function C() {',
          '  return <FormattedMessage id="title" />;',
          '}',
        ].join('\n'),
      });
      await expect(discoverReactIntlCatalogs(cwd, routing)).rejects.toThrow(
        /defaultMessage|synthesize/i
      );
    });
  });

  it('returns null when no catalog directory exists', async () => {
    const cwd = makeDir({ 'package.json': '{}' });
    expect(await discoverReactIntlCatalogs(cwd, routing)).toBeNull();
  });

  describe('B1: dotted keys re-nested into new files', () => {
    it('re-nests dotted flat keys and points loadDictionary at new files', async () => {
      const cwd = makeDir({
        'messages/en.json': JSON.stringify({
          'Home.title': 'Welcome',
          'Home.subtitle': 'Hi',
          flat: 'Flat',
        }),
        'messages/fr.json': JSON.stringify({
          'Home.title': 'Bienvenue',
          'Home.subtitle': 'Salut',
          flat: 'Plat',
        }),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      // byLocale is nested (what gt-next's runtime resolver walks).
      expect(catalogs!.byLocale.en).toEqual({
        Home: { title: 'Welcome', subtitle: 'Hi' },
        flat: 'Flat',
      });
      // originals are never mutated; new nested files are emitted and served.
      expect(catalogs!.dir).not.toBe(path.join(cwd, 'messages'));
      expect(path.basename(catalogs!.dir)).toBe('messages-gt');
      const emit = catalogs!.filesToEmit ?? [];
      expect(emit.map((e) => path.basename(e.path)).sort()).toEqual([
        'en.json',
        'fr.json',
      ]);
      // the original files are not queued for rewrite.
      expect(
        emit.some((e) => e.path === path.join(cwd, 'messages', 'en.json'))
      ).toBe(false);
      // the emitted nested content resolves the dotted id at runtime.
      const enOut = JSON.parse(
        emit.find((e) => e.path.endsWith('en.json'))!.content!
      );
      expect(enOut.Home.title).toBe('Welcome');
    });

    it('flags a flat/nested key collision and drops it from the nested catalog', async () => {
      const cwd = makeDir({
        'messages/en.json': JSON.stringify({ a: 'leaf', 'a.b': 'nested' }),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.flatKeyCollisions!.sort()).toEqual(['a', 'a.b']);
      // neither colliding id survives in the nested catalog.
      expect(catalogs!.byLocale.en.a).toBeUndefined();
    });
  });

  describe('M4: per-id harvest into an existing (partial) default catalog', () => {
    it('synthesizes only the missing ids from inline defaultMessages, into a new file', async () => {
      const cwd = makeDir({
        // default catalog exists but is missing `greeting`.
        'messages/en.json': JSON.stringify({ title: 'Welcome' }),
        'messages/fr.json': JSON.stringify({
          title: 'Bienvenue',
          greeting: 'Salut',
        }),
        'src/Client.tsx': [
          "'use client';",
          "import { useIntl, FormattedMessage } from 'react-intl';",
          'export function C() {',
          '  const intl = useIntl();',
          '  return (',
          '    <>',
          "      <h1>{intl.formatMessage({ id: 'title' })}</h1>",
          '      <p><FormattedMessage id="greeting" defaultMessage="Hello" /></p>',
          '    </>',
          '  );',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      // the missing id is filled from the inline defaultMessage.
      expect(catalogs!.byLocale.en.greeting).toBe('Hello');
      expect(catalogs!.byLocale.en.title).toBe('Welcome');
      // written to a NEW file (never mutating the original messages/en.json).
      expect(path.basename(catalogs!.dir)).toBe('messages-gt');
      expect(
        catalogs!.filesToEmit!.some(
          (e) => e.path === path.join(cwd, 'messages', 'en.json')
        )
      ).toBe(false);
      // and reported.
      expect(
        catalogs!.reportTodos!.some((t) => /greeting/.test(t.reason))
      ).toBe(true);
    });
  });

  describe('H2: report TODOs name the emitted -gt file, not the original', () => {
    it('points an augmentation TODO into the -gt directory that was written', async () => {
      const cwd = makeDir({
        'messages/en.json': JSON.stringify({ title: 'Welcome' }),
        'messages/fr.json': JSON.stringify({
          title: 'Bienvenue',
          greeting: 'Salut',
        }),
        'src/Client.tsx': [
          "'use client';",
          "import { FormattedMessage } from 'react-intl';",
          'export function C() {',
          '  return <p><FormattedMessage id="greeting" defaultMessage="Hello" /></p>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(path.basename(catalogs!.dir)).toBe('messages-gt');
      const todo = catalogs!.reportTodos!.find((t) => /missing/.test(t.reason));
      expect(todo).toBeDefined();
      // The TODO names the emitted -gt file, not the untouched original.
      expect(todo!.file).toBe(path.join(cwd, 'messages-gt', 'en.json'));
      expect(todo!.file).not.toBe(path.join(cwd, 'messages', 'en.json'));
      // And that path is actually one of the files the migration emits.
      expect(catalogs!.filesToEmit!.some((e) => e.path === todo!.file)).toBe(
        true
      );
    });

    it('points a re-nested synthesis TODO into the -gt directory', async () => {
      const cwd = makeDir({
        'messages/fr.json': JSON.stringify({ 'Home.title': 'Bienvenue' }),
        'src/P.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ children }: any) {',
          '  return <IntlProvider locale="x" defaultLocale="en">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/Client.tsx': [
          "'use client';",
          "import { FormattedMessage } from 'react-intl';",
          'export function C() {',
          '  return <p><FormattedMessage id="Home.title" defaultMessage="Welcome" /></p>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(path.basename(catalogs!.dir)).toBe('messages-gt');
      const todo = catalogs!.reportTodos!.find((t) =>
        /synthesized the source catalog/.test(t.reason)
      );
      expect(todo).toBeDefined();
      expect(todo!.file).toBe(path.join(cwd, 'messages-gt', 'en.json'));
      expect(catalogs!.filesToEmit!.some((e) => e.path === todo!.file)).toBe(
        true
      );
    });

    it('leaves a no-re-nest synthesis TODO pointing at the original directory', async () => {
      const cwd = makeDir({
        'messages/fr.json': JSON.stringify({ greeting: 'Salut' }),
        'src/P.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ children }: any) {',
          '  return <IntlProvider locale="x" defaultLocale="en">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/Client.tsx': [
          "'use client';",
          "import { FormattedMessage } from 'react-intl';",
          'export function C() {',
          '  return <p><FormattedMessage id="greeting" defaultMessage="Hello" /></p>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      // No dotted keys and no augmentation: the synthesized file lands in place.
      expect(path.basename(catalogs!.dir)).toBe('messages');
      const todo = catalogs!.reportTodos!.find((t) =>
        /synthesized the source catalog/.test(t.reason)
      );
      expect(todo).toBeDefined();
      expect(todo!.file).toBe(path.join(cwd, 'messages', 'en.json'));
      expect(catalogs!.filesToEmit!.some((e) => e.path === todo!.file)).toBe(
        true
      );
    });
  });

  describe('M2: conflicting defaultMessage variants (b2 synthesis)', () => {
    it('reports both variants and the winner, deterministically', async () => {
      const cwd = makeDir({
        'messages/fr.json': JSON.stringify({ greeting: 'Salut' }),
        'src/Provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ locale, children }: any) {',
          '  return <IntlProvider locale={locale} defaultLocale="en">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        // two call sites, same id, different defaultMessage.
        'src/A.tsx': [
          "'use client';",
          "import { FormattedMessage } from 'react-intl';",
          'export function A() {',
          '  return <FormattedMessage id="greeting" defaultMessage="Hello" />;',
          '}',
        ].join('\n'),
        'src/B.tsx': [
          "'use client';",
          "import { FormattedMessage } from 'react-intl';",
          'export function B() {',
          '  return <FormattedMessage id="greeting" defaultMessage="Hi there" />;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      const conflictTodo = catalogs!.reportTodos!.find((t) =>
        /greeting/.test(t.reason)
      );
      expect(conflictTodo).toBeDefined();
      expect(conflictTodo!.reason).toMatch(/Hello/);
      expect(conflictTodo!.reason).toMatch(/Hi there/);
      // first by sorted file order (A.tsx before B.tsx) wins.
      expect(catalogs!.byLocale.en.greeting).toBe('Hello');
    });
  });

  describe('m2: assumed default locale is reported', () => {
    it('warns when en is assumed with no declared default', async () => {
      const cwd = makeDir({
        'messages/en.json': JSON.stringify({ title: 'Welcome' }),
        'messages/fr.json': JSON.stringify({ title: 'Bienvenue' }),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.defaultLocale).toBe('en');
      expect((catalogs!.warnings ?? []).join(' ')).toMatch(/Assumed.*'en'/);
    });

    it('warns when the sole catalog is assumed to be the source', async () => {
      const cwd = makeDir({
        'messages/de.json': JSON.stringify({ title: 'Willkommen' }),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.defaultLocale).toBe('de');
      expect((catalogs!.warnings ?? []).join(' ')).toMatch(/Assumed 'de'/);
    });

    it('does not warn when the default locale is declared', async () => {
      const cwd = makeDir({
        'messages/de.json': JSON.stringify({ title: 'Willkommen' }),
        'messages/fr.json': JSON.stringify({ title: 'Bienvenue' }),
        'src/Provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function P({ children }: any) {',
          '  return <IntlProvider locale="de" defaultLocale="de">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.warnings ?? []).toEqual([]);
    });
  });

  describe('R1: conflicting declared defaultLocale', () => {
    it('picks deterministically and warns when files disagree', async () => {
      const cwd = makeDir({
        'messages/de.json': JSON.stringify({ title: 'Willkommen' }),
        'messages/fr.json': JSON.stringify({ title: 'Bienvenue' }),
        // Two providers declare different defaults. 'a-provider' sorts before
        // 'b-provider', so 'de' wins deterministically regardless of the
        // filesystem's own ordering.
        'src/a-provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function A({ children }: any) {',
          '  return <IntlProvider locale="de" defaultLocale="de">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/b-provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function B({ children }: any) {',
          '  return <IntlProvider locale="fr" defaultLocale="fr">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.defaultLocale).toBe('de');
      const warning = (catalogs!.warnings ?? []).join(' ');
      expect(warning).toMatch(
        /Multiple source files declare different defaultLocale/
      );
      // both candidates are named, sorted
      expect(warning).toContain('de, fr');
    });

    it('does not warn when the same value is declared in multiple files', async () => {
      const cwd = makeDir({
        'messages/de.json': JSON.stringify({ title: 'Willkommen' }),
        'messages/fr.json': JSON.stringify({ title: 'Bienvenue' }),
        'src/a-provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function A({ children }: any) {',
          '  return <IntlProvider locale="de" defaultLocale="de">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
        'src/b-provider.tsx': [
          "'use client';",
          "import { IntlProvider } from 'react-intl';",
          'export function B({ children }: any) {',
          '  return <IntlProvider locale="de" defaultLocale="de">{children}</IntlProvider>;',
          '}',
        ].join('\n'),
      });
      const catalogs = await discoverReactIntlCatalogs(cwd, routing);
      expect(catalogs!.defaultLocale).toBe('de');
      expect(catalogs!.warnings ?? []).toEqual([]);
    });
  });
});
