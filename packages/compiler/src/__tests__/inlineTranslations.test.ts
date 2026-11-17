/**
 * gt.config.json's files.gt.inlineTranslations embeds translations for the
 * configured locales as a callback at each <T> and unstable gt/t call site.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { transformWithPlugin } from './transformWithPlugin';
import type { GTUnpluginOptions } from '../index';
import { clearInlineTranslationsCache } from '../transform/injection/inline-translations/loadInlineTranslations';
import { hashSource } from 'generaltranslation/id';
import embeddedTemplateCases from '../../../../test-fixtures/embedded-message-templates.json';

const icuHash = (source: string, context?: string) =>
  hashSource({ source, ...(context && { context }), dataFormat: 'ICU' });

// Same hashes the SWC plugin tests pin (packages/next/swc-plugin/src/inline_translations_tests.rs)
const HELLO_WORLD = '8ffa9649730810de';
const HELLO_WORLD_GREETING = 'd13919d2202a590f';
const HELLO_NAME = 'b785eb9d5af50191';
const JSX_HELLO_WORLD = 'ebc5c5a5022c5050';

const T_COMPONENT_CODE = `
  import { jsx } from 'react/jsx-runtime';
  import { T } from 'gt-react';
  export const el = jsx(T, { children: "Hello world" });
`;

const USEGT_CODE = `
  import { useGT } from 'gt-react/unstable';
  const gt = useGT();
  gt\`Hello world\`;
`;

async function getHash(code: string, pattern: RegExp): Promise<string> {
  const output = await transformWithPlugin(undefined, code);
  const hash = output?.match(pattern)?.[1];
  if (!hash) throw new Error('hash not found in output:\n' + output);
  return hash;
}

const getGtHash = () => getHash(USEGT_CODE, /\$_hash: "([^"]+)"/);
const getTHash = () => getHash(T_COMPONENT_CODE, /_hash: "([^"]+)"/);

function createOutputDir(
  translations: Record<string, Record<string, unknown>> = {}
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-'));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [locale, entries] of Object.entries(translations)) {
    fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify(entries));
  }
  return dir;
}

function gtConfigOptions(
  locales: string[],
  outputDir: string | undefined
): GTUnpluginOptions {
  return {
    gtConfig: {
      files: {
        gt: {
          ...(outputDir && { output: path.join(outputDir, '[locale].json') }),
          inlineTranslations: { locales },
        },
      },
    },
  };
}

/** Options embedding `locales`, with `translations` written to files.gt.output. */
function inlineOptions(
  locales: string[],
  translations: Record<string, Record<string, unknown>>
): GTUnpluginOptions {
  return gtConfigOptions(locales, createOutputDir(translations));
}

describe('inlineTranslations in gt.config.json', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    clearInlineTranslationsCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adds an inline translations option to unstable gt templates', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr', 'es'], {
        fr: { [hash]: 'Bonjour le monde' },
        es: { [hash]: 'Hola mundo' },
      }),
      USEGT_CODE
    );
    expect(output).toContain(
      `gt({ $_hash: "${hash}", inline: (locale) => locale === "fr" ? "Bonjour le monde" : locale === "es" ? "Hola mundo" : void 0 })\`Hello world\``
    );
  });

  it('only embeds the configured locales', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr'], {
        fr: { [hash]: 'Bonjour le monde' },
        es: { [hash]: 'Hola mundo' },
      }),
      USEGT_CODE
    );
    expect(output).toContain('"Bonjour le monde"');
    expect(output).not.toContain('Hola mundo');
  });

  it('adds an inline prop to <T>', async () => {
    const hash = await getTHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { [hash]: 'Bonjour le monde' } }),
      T_COMPONENT_CODE
    );
    expect(output).toContain(
      'inline: (locale) => locale === "fr" ? "Bonjour le monde" : void 0'
    );
  });

  it('skips call sites without embedded translations', async () => {
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { 'other-hash': 'Autre' } }),
      USEGT_CODE
    );
    expect(output).toContain('$_hash');
    expect(output).not.toContain('(locale) =>');
  });

  it('embeds a repeated locale once', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr', 'fr'], { fr: { [hash]: 'Bonjour le monde' } }),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : void 0'
    );
  });

  it('skips locales without a translations file', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr', 'de'], { fr: { [hash]: 'Bonjour le monde' } }),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : void 0'
    );
  });

  it('does nothing without files.gt.output', async () => {
    const output = await transformWithPlugin(
      gtConfigOptions(['fr'], undefined),
      USEGT_CODE
    );
    expect(output).not.toContain('(locale) =>');
  });

  describe('unstable entry points', () => {
    const translations = { fr: { [HELLO_WORLD]: 'Bonjour le monde' } };
    const callback =
      'inline: (locale) => locale === "fr" ? "Bonjour le monde" : void 0';

    it.each([
      [
        'the SPA t',
        `import { t } from 'gt-react/unstable';
         t\`Hello world\`;`,
      ],
      [
        'await getGT()',
        `import { getGT } from 'gt-next/unstable';
         export async function label() {
           const gt = await getGT();
           return gt\`Hello world\`;
         }`,
      ],
      [
        'useGT() from react-core',
        `import { useGT } from '@generaltranslation/react-core/unstable';
         export function Label() {
           const gt = useGT();
           return gt\`Hello world\`;
         }`,
      ],
    ])('embeds translations for %s', async (_, code) => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        code
      );
      expect(output).toContain(callback);
    });

    it('embeds under the hash of literal options', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], {
          fr: { [HELLO_WORLD_GREETING]: 'Salut le monde' },
        }),
        `import { useGT } from 'gt-react/unstable';
         const gt = useGT();
         gt({ context: 'greeting' })\`Hello world\`;`
      );
      expect(output).toContain(
        `gt({ context: 'greeting', $_hash: "${HELLO_WORLD_GREETING}", inline: (locale) => locale === "fr" ? "Salut le monde" : void 0 })`
      );
    });

    it('embeds message trees with named variables', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], {
          fr: { [HELLO_NAME]: ['Salut, ', ['name'], ' !'] },
        }),
        `import { useGT } from 'gt-react/unstable';
         const gt = useGT();
         gt\`Hello, \${{ name }}!\`;`
      );
      expect(output).toContain(
        'inline: (locale) => locale === "fr" ? ["Salut, ", ["name"], " !"] : void 0'
      );
    });

    // The gt-next SWC plugin embeds a template only when every hole is a
    // named variable. An entry only this compiler builds also embeds helpers
    // whose values all have names. The CLI's isEmbeddedMessage reads the same
    // fixture, so msgOutput files leave out exactly what is embedded here.
    describe.each([
      ['gt-react/unstable', 't', true],
      ['gt-react/unstable', 'useGT()', true],
      ['gt-tanstack-start/unstable', 'useGT()', true],
      ['gt-next/unstable', 'useGT()', false],
      ['gt-i18n/unstable', 'useGT()', false],
    ] as const)(
      'embeds the templates of %s %s that test-fixtures/embedded-message-templates.json says it does',
      (source, tag, embedsHelpers) => {
        const prelude = `import { ${tag === 't' ? 't' : 'useGT'}, plural, selectordinal, select, number, date, time, part, derive, n } from '${source}';
          const name = 'Ada', count = 2, role = 'admin', price = 9.5, place = 1, currency = 'USD', timeZone = 'UTC', user = { name: 'Ada' };
          const due = new Date(0);
          ${tag === 't' ? '' : 'const t = useGT();'}`;

        it.each(
          embeddedTemplateCases.map((testCase) => [testCase.name, testCase])
        )('%s', async (_name, testCase) => {
          const { template, embeddedBy } = testCase;
          const setup = 'setup' in testCase ? testCase.setup : '';
          const code = `${prelude}\n${setup}\nexport const message = () => ${template};\n`;
          const hash = (await transformWithPlugin(undefined, code))?.match(
            /\$_hash: "([^"]+)"/
          )?.[1];
          // A template the compiler cannot hash is left to the runtime
          const output = hash
            ? await transformWithPlugin(
                inlineOptions(['fr'], { fr: { [hash]: 'Traduction' } }),
                code
              )
            : '';
          expect(output?.includes('inline: (locale) =>')).toBe(
            embeddedBy === 'every-compiler' ||
              (embeddedBy === '@generaltranslation/compiler' && embedsHelpers)
          );
        });
      }
    );

    it.each([
      ['an unnamed value', 'const count = 3;', '${count}'],
      ['plural()', '', '${plural({ count }, { one: "item", other: "items" })}'],
      ['a part fragment', '', '${part`items`}'],
    ])(
      'only hashes templates with %s, which the SWC plugin does not embed',
      async (_, setup, hole) => {
        const code = `import { useGT, plural, part } from 'gt-next/unstable';
           const gt = useGT();
           ${setup}
           gt\`You have ${hole}\`;`;
        const hash = await getHash(code, /\$_hash: "([^"]+)"/);
        const output = await transformWithPlugin(
          inlineOptions(['fr'], { fr: { [hash]: 'Vous avez' } }),
          code
        );
        expect(output).toContain(`$_hash: "${hash}"`);
        expect(output).not.toContain('inline:');
      }
    );

    it('only hashes unstable msg templates', async () => {
      // m() renders them away from their call site
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        `import { msg } from 'gt-react/unstable';
         export const label = msg\`Hello world\`;`
      );
      expect(output).toContain(`$_hash: "${HELLO_WORLD}"`);
      expect(output).not.toContain('inline:');
    });

    it('skips templates with derive content', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        `import { useGT, derive } from 'gt-react/unstable';
         const gt = useGT();
         gt\`Hello \${derive(getName())}\`;`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });
  });

  describe('stable gt() and t()', () => {
    const translations = {
      fr: { [icuHash('Hello world')]: 'Bonjour le monde' },
    };

    it.each([
      [
        'useGT()',
        `import { useGT } from 'gt-react';
         const gt = useGT();
         gt("Hello world");`,
      ],
      [
        't()',
        `import { t } from 'gt-react';
         t("Hello world");`,
      ],
      [
        'getGT()',
        `import { getGT } from 'gt-next/server';
         export async function label() {
           const gt = await getGT();
           return gt("Hello world");
         }`,
      ],
    ])('leaves %s calls without a callback', async (_, code) => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        code
      );
      expect(output ?? '').not.toContain('(locale) =>');
      expect(output ?? '').not.toContain('Bonjour le monde');
    });
  });

  it('re-reads a locale file edited between builds', async () => {
    const hash = await getGtHash();
    const dir = createOutputDir({ fr: { [hash]: 'Bonjour le monde' } });
    const file = path.join(dir, 'fr.json');
    const options = gtConfigOptions(['fr'], dir);
    await transformWithPlugin(options, USEGT_CODE);

    fs.writeFileSync(file, JSON.stringify({ [hash]: 'Salut le monde' }));
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(file, later, later);
    const output = await transformWithPlugin(options, USEGT_CODE);
    expect(output).toContain('"Salut le monde"');
    expect(output).not.toContain('"Bonjour le monde"');
  });

  it.each([
    ['some locale files exist', { fr: { [HELLO_WORLD]: 'Bonjour le monde' } }],
    ['no locale file exists', {}],
  ])(
    'registers configured locale files as watch dependencies when %s',
    async (_, translations) => {
      const dir = createOutputDir(translations);
      const watched: string[] = [];
      await transformWithPlugin(
        gtConfigOptions(['fr', 'de'], dir),
        USEGT_CODE,
        (watchedFile) => watched.push(watchedFile)
      );
      expect(watched).toEqual([
        path.join(dir, 'fr.json'),
        path.join(dir, 'de.json'),
      ]);
    }
  );

  it('names a locale file that is not valid JSON', async () => {
    const dir = createOutputDir();
    const file = path.join(dir, 'fr.json');
    fs.writeFileSync(file, '{ "abc": ');
    await expect(
      transformWithPlugin(gtConfigOptions(['fr'], dir), USEGT_CODE)
    ).rejects.toThrow(`Could not read the embedded translations in ${file}`);
  });

  it('falls back with void 0, which a local undefined binding cannot shadow', async () => {
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { [HELLO_WORLD]: 'Bonjour le monde' } }),
      `import { useGT } from 'gt-react/unstable';
       export function f(undefined) {
         const gt = useGT();
         return gt\`Hello world\`;
       }`
    );
    expect(output).toContain(
      'inline: (locale) => locale === "fr" ? "Bonjour le monde" : void 0'
    );
  });

  it('does not embed translations outside production builds', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { [hash]: 'Bonjour le monde' } }),
      USEGT_CODE
    );
    expect(output).not.toContain('Bonjour le monde');
  });

  describe('derive (not supported)', () => {
    // null output means the file was left untouched
    const translations = {
      fr: { [icuHash('Hello world')]: 'Bonjour le monde' },
    };

    it('skips <T> with <Derive> children', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        `import { jsx, jsxs } from 'react/jsx-runtime';
         import { T, Derive } from 'gt-react';
         export const el = jsxs(T, { children: ["Hello ", jsx(Derive, { children: getName() })] });`
      );
      expect(output ?? '').not.toContain('inline:');
    });
  });

  describe('parity with the SWC plugin', () => {
    it('computes the same unstable gt and <T> hashes', async () => {
      expect(await getGtHash()).toBe(HELLO_WORLD);
      expect(await getTHash()).toBe(JSX_HELLO_WORLD);
    });

    it('keeps locale order from the config', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['es', 'fr'], {
          fr: { [HELLO_WORLD]: 'Bonjour le monde' },
          es: { [HELLO_WORLD]: 'Hola mundo' },
        }),
        USEGT_CODE
      );
      expect(output).toContain(
        'locale === "es" ? "Hola mundo" : locale === "fr" ? "Bonjour le monde"'
      );
    });

    it('does nothing without inline translations', async () => {
      const output = await transformWithPlugin(undefined, USEGT_CODE);
      expect(output).not.toContain('(locale) =>');
    });

    describe('<T> props', () => {
      const customOptions = () =>
        inlineOptions(['fr'], { fr: { custom: 'Perso' } });

      it('embeds <T> under a literal _hash, which the runtime looks up', async () => {
        const output = await transformWithPlugin(
          customOptions(),
          `import { jsx } from 'react/jsx-runtime';
           import { T } from 'gt-react';
           export const el = jsx(T, { children: "Hello world", _hash: "custom" });`
        );
        expect(output).toContain(
          'inline: (locale) => locale === "fr" ? "Perso" : void 0'
        );
      });

      it('skips <T> with a $_hash prop, which the runtime prefers', async () => {
        const output = await transformWithPlugin(
          inlineOptions(['fr'], {
            fr: { [JSX_HELLO_WORLD]: 'Bonjour le monde' },
          }),
          `import { jsx } from 'react/jsx-runtime';
           import { T } from 'gt-react';
           export const el = jsx(T, { children: "Hello world", $_hash: "custom" });`
        );
        expect(output ?? '').not.toContain('inline:');
      });

      it.each([
        ['a computed key', '[key]: "other"'],
        ['a repeated _hash', '"_hash": "other"'],
      ])('skips <T> with %s, which may override _hash', async (_, prop) => {
        const output = await transformWithPlugin(
          customOptions(),
          `import { jsx } from 'react/jsx-runtime';
           import { T } from 'gt-react';
           export const el = jsx(T, { children: "Hello world", _hash: "custom", ${prop} });`
        );
        expect(output ?? '').not.toContain('inline:');
      });

      it('skips <T> with spread props', async () => {
        const output = await transformWithPlugin(
          inlineOptions(['fr'], {
            fr: { [JSX_HELLO_WORLD]: 'Bonjour le monde' },
          }),
          `import { jsx } from 'react/jsx-runtime';
           import { T } from 'gt-react';
           export const el = jsx(T, { ...props, children: "Hello world" });`
        );
        expect(output ?? '').not.toContain('inline:');
      });
    });

    it('embeds JSX children objects for <T>', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], {
          fr: { [JSX_HELLO_WORLD]: ['Bonjour ', { c: 'monde', i: 1 }] },
        }),
        T_COMPONENT_CODE
      );
      expect(output).toContain('locale === "fr" ? ["Bonjour ", {');
      expect(output).toContain('c: "monde"');
    });

    it('skips <T> without embedded translations', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], { fr: {} }),
        T_COMPONENT_CODE
      );
      expect(output).toContain('_hash: "');
      expect(output).not.toContain('inline:');
    });

    it('never embeds translations in msg() calls', async () => {
      // msg() strings load from the msg()-only translations file instead
      const output = await transformWithPlugin(
        inlineOptions(['fr'], { fr: { [icuHash('Hello')]: 'Bonjour' } }),
        `import { msg } from 'gt-react';
         export const a = msg("Hello");
         export const b = msg("Hello", { $id: "greeting" });`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });
  });
});
