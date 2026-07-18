import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverReactIntlCatalogs } from '../adapters/reactIntlCatalogs.js';
import type { RoutingInfo } from '../types.js';

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
      'messages/fr.json': JSON.stringify({ title: 'Bienvenue', hi: 'Salut {name}' }),
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
});
