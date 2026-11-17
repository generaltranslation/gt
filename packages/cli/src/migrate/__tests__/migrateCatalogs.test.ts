import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MessageTree } from '@generaltranslation/icu';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import {
  type Catalog,
  detectCatalogEra,
  type LegacySources,
  parseLegacySource,
} from '../catalogs.js';
import { validateMigratedTranslation } from '../convert/index.js';
import {
  migrateCatalogs,
  type MigrateCatalogsInput,
  type NewMessage,
} from '../migrateCatalogs.js';
import { readNewMessages } from '../newMessages.js';
import {
  completeLocales,
  type LocaleSummary,
  sourceTextLength,
  summarizeReport,
} from '../summary.js';
import type { MatchTier, MessageDecision, MigrationReport } from '../types.js';

const readFixture = <T>(file: string): T =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/legacy-app/${file}`, import.meta.url),
      'utf8'
    )
  ) as T;

type FixtureSource = Record<string, unknown> & {
  source: unknown;
  deriveGroup?: string;
};
type Expected = {
  messages: Record<
    string,
    { intent: string | null; expect: 'match' | 'optional' | 'no-match' }
  >;
  brokenTranslations: { hash: string; locale: string }[];
};

const FIXTURE_LOCALES = ['fr', 'de', 'ru', 'ja', 'ar'];
const newSource = readFixture<Record<string, FixtureSource>>('new-source.json');
const expected = readFixture<Expected>('expected.json');
const fixtureMessages = readNewMessages(
  Object.fromEntries(
    Object.entries(newSource).map(([hash, { source }]) => [hash, source])
  ),
  Object.fromEntries(
    Object.entries(newSource).map(
      ([hash, { source: _source, deriveGroup, ...metadata }]) => [
        hash,
        { ...metadata, ...(deriveGroup && { staticId: deriveGroup }) },
      ]
    )
  )
);
const fixtureCatalogs = Object.fromEntries(
  FIXTURE_LOCALES.map((locale) => [
    locale,
    readFixture<Catalog>(`old-catalogs/${locale}.json`),
  ])
);
const fixtureSources = parseLegacySource(
  readFixture<Catalog>('old-catalogs/en.json')
);

const migrateFixture = (
  sources: LegacySources | undefined,
  fill = true
): ReturnType<typeof migrateCatalogs> =>
  migrateCatalogs({
    messages: fixtureMessages,
    sources,
    catalogs: fixtureCatalogs,
    locales: FIXTURE_LOCALES,
    defaultLocale: 'en',
    fill,
    loose: false,
  });

const decisionsByHash = (report: MigrationReport) =>
  new Map(report.messages.map((message) => [message.newHash, message]));

const summary = (
  locale: string,
  counts: Omit<LocaleSummary, 'locale'>
): LocaleSummary => ({ locale, ...counts });

const SOURCE_TIERS: (MatchTier | undefined)[] = [
  'source-exact',
  'source-alpha',
  'source-loose',
];

describe('migrateCatalogs on the legacy-app fixture', () => {
  const withSource = migrateFixture(fixtureSources);
  const withSourceDecisions = decisionsByHash(withSource.report);
  const fixtureCases = Object.entries(expected.messages).map(
    ([hash, message]) => ({ hash, ...message })
  );

  it('reads every new message, with derive groups as static ids', () => {
    expect(fixtureMessages).toHaveLength(59);
    expect(
      fixtureMessages
        .filter((message) => message.staticId)
        .map(({ hash, staticId }) => [hash, staticId])
    ).toEqual([
      ['c4fc26b3dd0a3630', 'derive-1'],
      ['c3a8fa5391cc5681', 'derive-1'],
      ['724272c571c9aa01', 'derive-1'],
      ['79f3d898c44c9db1', 'derive-2'],
      ['6c22bbb27a88235a', 'derive-2'],
    ]);
  });

  it.each(fixtureCases.filter((message) => message.expect === 'match'))(
    'migrates $hash from $intent',
    ({ hash, intent }) => {
      const decision = withSourceDecisions.get(hash)!;
      expect(decision.oldKey).toBe(intent);
      expect(
        FIXTURE_LOCALES.filter(
          (locale) => decision.locales[locale].status === 'missing'
        )
      ).toEqual([]);
    }
  );

  it.each(fixtureCases.filter((message) => message.expect === 'no-match'))(
    'gives $hash no translation',
    ({ hash }) => {
      const decision = withSourceDecisions.get(hash)!;
      expect(decision.oldKey).toBeUndefined();
      expect(
        FIXTURE_LOCALES.filter(
          (locale) =>
            decision.locales[locale].status !== 'missing' ||
            hash in withSource.catalogs[locale]
        )
      ).toEqual([]);
    }
  );

  it.each(fixtureCases.filter((message) => message.expect === 'optional'))(
    'migrates the optional $hash from $intent or not at all',
    ({ hash, intent }) => {
      const { oldKey } = withSourceDecisions.get(hash)!;
      expect([undefined, intent]).toContain(oldKey);
    }
  );

  it.each(expected.brokenTranslations)(
    'rejects the broken $locale translation of $hash',
    ({ hash, locale }) => {
      const decision = withSource.report.messages.find(
        (message) => message.oldKey === hash
      )!;
      expect(decision.locales[locale].status).toBe('rejected');
      expect(decision.newHash in withSource.catalogs[locale]).toBe(false);
    }
  );

  it('writes only MESSAGE_TREE values the server accepts', () => {
    const checked = withSource.report.messages
      .filter((message) => message.dataFormat === 'MESSAGE_TREE')
      .flatMap((message) =>
        FIXTURE_LOCALES.filter(
          (locale) => message.newHash in withSource.catalogs[locale]
        ).map((locale) => ({
          hash: message.newHash,
          locale,
          error: validateMigratedTranslation(
            message.source as MessageTree,
            withSource.catalogs[locale][message.newHash],
            locale
          ),
        }))
      );
    expect(checked).toHaveLength(167);
    expect(checked.filter(({ error }) => error !== undefined)).toEqual([]);
  });

  it('carries values whose key and format are unchanged verbatim', () => {
    const carried = withSource.report.messages.filter(
      (message) =>
        message.tier === 'same-key' && message.dataFormat !== 'MESSAGE_TREE'
    );
    expect(carried).toHaveLength(16);
    for (const message of carried) {
      for (const locale of FIXTURE_LOCALES) {
        expect(withSource.catalogs[locale][message.newHash]).toBe(
          fixtureCatalogs[locale][message.newHash]
        );
      }
    }
  });

  it('summarizes every locale', () => {
    expect(summarizeReport(withSource.report)).toEqual([
      summary('fr', {
        carried: 17,
        migrated: {
          'predicted-hash': 25,
          'source-alpha': 5,
          'source-exact': 3,
        },
        filled: 4,
        rejected: 1,
        missing: 8,
        missingChars: 194,
      }),
      summary('de', {
        carried: 17,
        migrated: {
          'predicted-hash': 26,
          'source-alpha': 4,
          'source-exact': 3,
        },
        filled: 0,
        rejected: 1,
        missing: 8,
        missingChars: 202,
      }),
      summary('ru', {
        carried: 17,
        migrated: {
          'predicted-hash': 26,
          'source-alpha': 5,
          'source-exact': 3,
        },
        filled: 2,
        rejected: 0,
        missing: 8,
        missingChars: 171,
      }),
      summary('ja', {
        carried: 17,
        migrated: {
          'predicted-hash': 26,
          'source-alpha': 4,
          'source-exact': 3,
        },
        filled: 0,
        rejected: 1,
        missing: 8,
        missingChars: 204,
      }),
      summary('ar', {
        carried: 17,
        migrated: {
          'predicted-hash': 26,
          'source-alpha': 5,
          'source-exact': 3,
        },
        filled: 4,
        rejected: 0,
        missing: 8,
        missingChars: 171,
      }),
    ]);
    expect(completeLocales(withSource.report)).toEqual([]);
  });

  describe('without the legacy source file', () => {
    const withoutSource = migrateFixture(undefined);

    it('matches only by key and predicted hash', () => {
      const tiers = new Set(
        withoutSource.report.messages.map((message) => message.tier)
      );
      expect([...tiers].sort()).toEqual([
        'predicted-hash',
        'same-key',
        undefined,
      ]);
    });

    it('matches nothing that needs the source, and the rest as before', () => {
      for (const message of withoutSource.report.messages) {
        const before = withSourceDecisions.get(message.newHash)!;
        expect(message.oldKey).toBe(
          SOURCE_TIERS.includes(before.tier) ? undefined : before.oldKey
        );
      }
    });

    it('summarizes every locale', () => {
      const migrated = (count: number) => ({ 'predicted-hash': count });
      expect(summarizeReport(withoutSource.report)).toEqual([
        summary('fr', {
          carried: 17,
          migrated: migrated(25),
          filled: 3,
          rejected: 1,
          missing: 16,
          missingChars: 410,
        }),
        summary('de', {
          carried: 17,
          migrated: migrated(26),
          filled: 0,
          rejected: 0,
          missing: 16,
          missingChars: 387,
        }),
        summary('ru', {
          carried: 17,
          migrated: migrated(26),
          filled: 1,
          rejected: 0,
          missing: 16,
          missingChars: 387,
        }),
        summary('ja', {
          carried: 17,
          migrated: migrated(26),
          filled: 0,
          rejected: 0,
          missing: 16,
          missingChars: 387,
        }),
        summary('ar', {
          carried: 17,
          migrated: migrated(26),
          filled: 3,
          rejected: 0,
          missing: 16,
          missingChars: 387,
        }),
      ]);
    });
  });

  it('rejects French plurals without many when filling is off', () => {
    const { report } = migrateFixture(fixtureSources, false);
    const rejected = Object.fromEntries(
      report.messages.flatMap(({ newHash, locales: { fr } }) =>
        fr.status === 'rejected' ? [[newHash, fr.reason]] : []
      )
    );
    const missingMany = (variable: string) =>
      `The translation does not match its source: "${variable}" is missing the plural branch many, which fr needs.`;
    expect(rejected).toEqual({
      '23e11cb27f14eb19': missingMany('count'),
      '22b5898b2c89aa60': missingMany('count'),
      '5b409e6b3e3d741a': missingMany('_gt_1'),
      '894b5f58be761c1a': missingMany('count'),
      cd2f8827bcc97321:
        'The translation does not match its source: "nom" does not exist in the source; "name" is missing from the translation.',
    });
    expect(
      report.messages.filter(
        (message) => message.locales.fr.status === 'migrated'
      )
    ).toHaveLength(29);
  });
});

const NEW_HASH = 'aaaaaaaaaaaaaaaa';

const legacyIcuHash = (
  source: string,
  meta: { context?: string; maxChars?: number } = {}
) => hashSource({ source: indexVars(source), dataFormat: 'ICU', ...meta });

const treeMessage = (
  source: MessageTree,
  extra: Partial<NewMessage> = {}
): NewMessage => ({
  hash: NEW_HASH,
  dataFormat: 'MESSAGE_TREE',
  source,
  ...extra,
});

const migrate = ({
  catalogs,
  ...input
}: Partial<MigrateCatalogsInput> &
  Pick<MigrateCatalogsInput, 'messages' | 'catalogs'>) =>
  migrateCatalogs({
    catalogs,
    locales: Object.keys(catalogs),
    defaultLocale: 'en',
    fill: true,
    loose: false,
    ...input,
  });

const only = (result: ReturnType<typeof migrateCatalogs>): MessageDecision =>
  result.report.messages[0];

describe('migrateCatalogs', () => {
  it.each([
    {
      dataFormat: 'JSX' as const,
      source: ['Hello ', { k: 'name' }],
      value: ['Bonjour ', { k: 'name' }],
    },
    {
      dataFormat: 'ICU' as const,
      source: '{count, plural, one {# item} other {# items}}',
      value: '{count, plural, one {# article} other {# articles}}',
    },
  ])(
    'carries a $dataFormat value under the same key unchanged',
    ({ dataFormat, source, value }) => {
      const result = migrate({
        messages: [{ hash: NEW_HASH, dataFormat, source }],
        catalogs: { fr: { [NEW_HASH]: value } },
      });
      expect(only(result)).toEqual({
        newHash: NEW_HASH,
        dataFormat,
        source,
        tier: 'same-key',
        oldKey: NEW_HASH,
        oldDataFormat: dataFormat,
        notes: [],
        locales: { fr: { status: 'carried' } },
      });
      expect(result.catalogs.fr[NEW_HASH]).toBe(value);
    }
  );

  it('rejects a same-key MESSAGE_TREE value that is an ICU string with a variable', () => {
    const result = migrate({
      messages: [treeMessage(['Hello ', ['name']])],
      catalogs: { fr: { [NEW_HASH]: 'Bonjour {name}' } },
    });
    expect(only(result).locales).toEqual({
      fr: {
        status: 'rejected',
        reason:
          'The translation does not match its source: "name" is missing from the translation.',
      },
    });
    expect(result.catalogs).toEqual({ fr: {} });
  });

  it('falls back per locale to the old key when a locale lacks the new key', () => {
    const oldKey = legacyIcuHash('Hello');
    const result = migrate({
      messages: [treeMessage('Hello')],
      catalogs: {
        fr: { [NEW_HASH]: 'Bonjour' },
        de: { [oldKey]: 'Hallo' },
      },
    });
    expect(only(result)).toMatchObject({
      tier: 'same-key',
      oldKey: NEW_HASH,
      notes: [
        `Locales without the key fall back to ${oldKey} (predicted-hash)`,
      ],
      locales: {
        fr: { status: 'carried' },
        de: { status: 'migrated', oldKey },
      },
    });
    expect(result.catalogs).toEqual({
      fr: { [NEW_HASH]: 'Bonjour' },
      de: { [NEW_HASH]: 'Hallo' },
    });
  });

  describe('text matches among old messages with other context', () => {
    const buttonKey = legacyIcuHash('Save', { context: 'Button' });
    const discountKey = legacyIcuHash('Save', { context: 'Discount' });
    const sources = parseLegacySource({
      [buttonKey]: 'Save',
      [discountKey]: 'Save',
    });
    const message = treeMessage('Save', { context: 'Settings form' });

    it('matches nothing when the candidates have different translations', () => {
      const result = migrate({
        messages: [message],
        sources,
        catalogs: {
          fr: { [buttonKey]: 'Enregistrer', [discountKey]: 'Économiser' },
        },
      });
      expect(only(result)).toEqual({
        newHash: NEW_HASH,
        dataFormat: 'MESSAGE_TREE',
        source: 'Save',
        notes: [
          `2 old messages have this text with other context or maxChars and different translations: ${buttonKey}, ${discountKey}`,
        ],
        locales: { fr: { status: 'missing' } },
      });
      expect(result.catalogs).toEqual({ fr: {} });
    });

    it('takes the first candidate when every translation agrees', () => {
      const result = migrate({
        messages: [message],
        sources,
        catalogs: {
          fr: { [buttonKey]: 'Enregistrer', [discountKey]: 'Enregistrer' },
        },
      });
      expect(only(result)).toMatchObject({
        tier: 'source-exact',
        oldKey: buttonKey,
        notes: [
          'The context, maxChars or requiresReview differs from the old message',
          `Chose ${buttonKey} of ${buttonKey}, ${discountKey}`,
        ],
        locales: { fr: { status: 'migrated' } },
      });
      expect(result.catalogs).toEqual({ fr: { [NEW_HASH]: 'Enregistrer' } });
    });

    it('accepts a unique candidate whose hash does not verify, with a note', () => {
      const result = migrate({
        messages: [message],
        sources: parseLegacySource({ [buttonKey]: 'Save' }),
        catalogs: { fr: { [buttonKey]: 'Enregistrer' } },
      });
      expect(only(result)).toMatchObject({
        tier: 'source-exact',
        oldKey: buttonKey,
        oldDataFormat: 'ICU',
        notes: [
          'The context, maxChars or requiresReview differs from the old message',
        ],
        locales: { fr: { status: 'migrated' } },
      });
      expect(result.catalogs).toEqual({ fr: { [NEW_HASH]: 'Enregistrer' } });
    });
  });

  it.each([
    { loose: false, tier: undefined, fr: { status: 'missing' }, value: {} },
    {
      loose: true,
      tier: 'source-loose',
      fr: { status: 'migrated' },
      value: { [NEW_HASH]: 'Bonjour  le monde' },
    },
  ])(
    'matches text differing in whitespace when loose is $loose',
    ({ loose, tier, fr, value }) => {
      const oldKey = legacyIcuHash('Hello  world');
      const result = migrate({
        messages: [treeMessage('Hello world')],
        sources: parseLegacySource({ [oldKey]: 'Hello  world' }),
        catalogs: { fr: { [oldKey]: 'Bonjour  le monde' } },
        loose,
      });
      expect(only(result).tier).toBe(tier);
      expect(only(result).locales.fr).toEqual(fr);
      expect(result.catalogs.fr).toEqual(value);
    }
  );

  it('records the rename from a legacy _gt_N variable', () => {
    const oldSource = 'Good to see you, {_gt_1}!';
    const oldKey = legacyIcuHash(oldSource);
    const result = migrate({
      messages: [treeMessage(['Good to see you, ', ['username'], '!'])],
      sources: parseLegacySource({ [oldKey]: oldSource }),
      catalogs: { fr: { [oldKey]: 'Ravi de vous voir, {_gt_1} !' } },
    });
    expect(only(result)).toMatchObject({
      tier: 'source-alpha',
      oldKey,
      renameMap: { _gt_1: 'username' },
      notes: [],
      locales: { fr: { status: 'migrated' } },
    });
    expect(result.catalogs.fr).toEqual({
      [NEW_HASH]: ['Ravi de vous voir, ', ['username'], ' !'],
    });
  });

  describe('a dictionary-form legacy source', () => {
    const sources = parseLegacySource({
      greeting: { hello: 'Hello' },
      save: ['Save', { $context: 'Button' }],
    });
    const messages = [
      treeMessage('Hello'),
      treeMessage('Save', { hash: 'bbbbbbbbbbbbbbbb', context: 'Button' }),
    ];

    it('matches translations keyed by hash', () => {
      const result = migrate({
        messages,
        sources,
        catalogs: {
          fr: {
            [legacyIcuHash('Hello')]: 'Bonjour',
            [legacyIcuHash('Save', { context: 'Button' })]: 'Enregistrer',
          },
        },
      });
      expect(result.catalogs.fr).toEqual({
        [NEW_HASH]: 'Bonjour',
        bbbbbbbbbbbbbbbb: 'Enregistrer',
      });
    });

    // The predicted hash exists only in the default locale file, so it wins over the id key every locale file has.
    it('matches translations keyed by dotted id', () => {
      const result = migrate({
        messages,
        sources,
        catalogs: {
          fr: { 'greeting.hello': 'Bonjour', save: 'Enregistrer' },
        },
      });
      expect(result.report.messages.map((message) => message.oldKey)).toEqual([
        'greeting.hello',
        'save',
      ]);
      expect(result.catalogs.fr).toEqual({
        [NEW_HASH]: 'Bonjour',
        bbbbbbbbbbbbbbbb: 'Enregistrer',
      });
    });
  });
});

describe('detectCatalogEra', () => {
  const HASH = '0123456789abcdef';
  const LONG_HASH = 'ab'.repeat(32);

  it.each([
    {
      name: 'a 64-character key',
      catalog: { [HASH]: 'Hi', [LONG_HASH]: 'Hello' },
      era: {
        era: 'pre-2025',
        reason: `it has the 64-character key ${LONG_HASH}`,
      },
    },
    {
      name: 'a {type, props} element',
      catalog: { [HASH]: { type: 'div', props: { children: 'Hi' } } },
      era: {
        era: 'pre-2025',
        reason: `the value of ${HASH} is JSX in the {type, props} form`,
      },
    },
    {
      name: 'a {type, props} element among children',
      catalog: { [HASH]: ['Hi ', { type: 'b', props: {} }] },
      era: {
        era: 'pre-2025',
        reason: `the value of ${HASH} is JSX in the {type, props} form`,
      },
    },
    {
      name: 'hash keys and GTJSX',
      catalog: { [HASH]: ['Hi ', { t: 'b', c: 'there', i: 1 }] },
      era: { era: 'current', idKeys: 0 },
    },
    {
      name: 'id keys',
      catalog: { [HASH]: 'Hi', 'greeting.hello': 'Hello', save: 'Save' },
      era: { era: 'current', idKeys: 2 },
    },
  ])('detects $name', ({ catalog, era }) => {
    expect(detectCatalogEra(catalog)).toEqual(era);
  });
});

describe('parseLegacySource', () => {
  it.each([
    { name: 'strings', value: 'Hello' },
    { name: 'GTJSX children', value: ['Hello ', { k: 'name' }] },
    { name: 'a GTJSX element', value: { t: 'b', c: 'Hello', i: 1 } },
  ])('reads a hash catalog of $name', ({ value }) => {
    const json = { '0123456789abcdef': value, fedcba9876543210: 'Bye' };
    expect(parseLegacySource(json)).toEqual({
      values: new Map(Object.entries(json)),
      formats: new Map(),
      entries: new Map(),
      kind: 'hashes',
    });
  });

  it.each([
    {
      name: 'nested entries and metadata',
      json: {
        greeting: { hello: 'Hello' },
        save: ['Save', { $context: 'Button', $maxChars: -10 }],
      },
      entries: [
        [legacyIcuHash('Hello'), 'Hello', 'greeting.hello'],
        ['greeting.hello', 'Hello', 'greeting.hello'],
        [
          legacyIcuHash('Save', { context: 'Button', maxChars: 10 }),
          'Save',
          'save',
        ],
        ['save', 'Save', 'save'],
      ],
    },
    {
      name: 'a hash key beside a nested entry',
      json: { '0123456789abcdef': 'Hi', nav: { home: 'Home' } },
      entries: [
        [legacyIcuHash('Hi'), 'Hi', '0123456789abcdef'],
        ['0123456789abcdef', 'Hi', '0123456789abcdef'],
        [legacyIcuHash('Home'), 'Home', 'nav.home'],
        ['nav.home', 'Home', 'nav.home'],
      ],
    },
  ])('reads a dictionary with $name by hash and id', ({ json, entries }) => {
    expect(parseLegacySource(json)).toEqual({
      values: new Map(entries.map(([key, value]) => [key, value])),
      formats: new Map(entries.map(([key]) => [key, 'ICU'])),
      entries: new Map(entries.map(([key, , id]) => [key, id])),
      kind: 'dictionary',
    });
  });
});

describe('summary', () => {
  it.each([
    { source: 'Hello', dataFormat: 'MESSAGE_TREE', length: 5 },
    { source: ['Hi ', ['name'], '!'], dataFormat: 'MESSAGE_TREE', length: 4 },
    {
      source: [
        ['n', 'plural', { one: [0, ' day'], other: [0, ' days'] }],
        ' left',
      ],
      dataFormat: 'MESSAGE_TREE',
      length: 14,
    },
    {
      source: ['Read ', ['link', 'tag', 'the docs']],
      dataFormat: 'MESSAGE_TREE',
      length: 13,
    },
    { source: 'Hello', dataFormat: 'ICU', length: 5 },
    { source: ['Hi ', { t: 'b', c: 'there' }], dataFormat: 'JSX', length: 8 },
    {
      source: { t: 'Plural', d: { b: { one: 'a', other: 'bb' } } },
      dataFormat: 'JSX',
      length: 3,
    },
    { source: ['Hi ', { k: 'name' }], dataFormat: 'JSX', length: 3 },
  ])(
    'counts $length characters of $dataFormat $source',
    ({ source, dataFormat, length }) => {
      expect(sourceTextLength(source, dataFormat)).toBe(length);
    }
  );

  const decision = (
    tier: MatchTier | undefined,
    locales: MessageDecision['locales'],
    source: unknown = 'Hello'
  ): MessageDecision => ({
    newHash: 'aaaaaaaaaaaaaaaa',
    dataFormat: 'MESSAGE_TREE',
    source,
    ...(tier && { tier }),
    notes: [],
    locales,
  });
  const filled = { categories: 1, keys: 0, dropped: 0 };
  const report: MigrationReport = {
    version: 1,
    defaultLocale: 'en',
    locales: ['fr', 'de', 'ja'],
    messages: [
      decision('same-key', {
        fr: { status: 'carried' },
        de: { status: 'migrated', filled },
        ja: { status: 'carried' },
      }),
      decision(
        'source-alpha',
        {
          fr: { status: 'migrated', filled },
          de: { status: 'rejected', reason: 'bad' },
          ja: { status: 'migrated' },
        },
        'Goodbye'
      ),
      decision(undefined, { fr: { status: 'carried' } }, 'Later'),
    ],
  };

  it('counts each locale outcome by tier', () => {
    expect(summarizeReport(report)).toEqual([
      summary('fr', {
        carried: 2,
        migrated: { 'source-alpha': 1 },
        filled: 1,
        rejected: 0,
        missing: 0,
        missingChars: 0,
      }),
      summary('de', {
        carried: 0,
        migrated: { 'same-key': 1 },
        filled: 1,
        rejected: 1,
        missing: 1,
        missingChars: 12,
      }),
      summary('ja', {
        carried: 1,
        migrated: { 'source-alpha': 1 },
        filled: 0,
        rejected: 0,
        missing: 1,
        missingChars: 5,
      }),
    ]);
  });

  it('lists the locales with a value for every message', () => {
    expect(completeLocales(report)).toEqual(['fr']);
  });
});
