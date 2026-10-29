/**
 * Server rendering with locale twins must produce what the browser renders
 * from its twins, or hydration fails. The browser only has translations for
 * entries the compiler attributed (compile-time hash); everything else renders
 * its source text there, so the server must render it the same way.
 */
import { renderToString } from 'react-dom/server';
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal';
import { hashMessage } from 'gt-i18n/internal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pluginModule, currentRequest } = vi.hoisted(() => ({
  pluginModule: {
    config: undefined as Record<string, unknown> | undefined,
    loadTranslations: undefined as
      | ((locale: string) => Promise<Record<string, string>>)
      | undefined,
    dictionary: undefined,
    loadDictionary: undefined,
  },
  currentRequest: { value: undefined as Request | undefined },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => {
    if (!currentRequest.value) throw new Error('No StartEvent');
    return currentRequest.value;
  },
  setCookie: vi.fn(),
  getResponseHeader: vi.fn(),
  setResponseHeader: vi.fn(),
}));

import {
  GtInternalRegisterLocaleTwin,
  msg,
  t,
  T,
  useGT,
  useMessages,
} from '../index.server';
import { ensureInitialized } from '../setup/initializeGT.server';
import { setupRouterGTIntegration } from '../router/setupRouterGTIntegration.server';
import type { GTRouterOptions } from '../router/types';

// Compile-time hashes, as the compiler injects them (16 lowercase hex).
const T_HASH = '1111111111111111';
const GT_HASH = '2222222222222222';
const MSG_HASH = '3333333333333333';
const T_FN_HASH = '4444444444444444';

/** French translations keyed like `fr.json`, runtime hashes included. */
const FRENCH = {
  [T_HASH]: 'Bonjour',
  [GT_HASH]: 'Marées',
  [MSG_HASH]: 'Cartes',
  [T_FN_HASH]: 'Brouillard',
  [hashMessage('Notice', { $format: 'JSX' })]: 'Avis',
  [hashMessage('Season', { $format: 'ICU' })]: 'Saison',
};

const attributedMsg = msg('Maps', { $_hash: MSG_HASH });

function Page() {
  const gt = useGT();
  const m = useMessages();
  return (
    <main>
      <T _hash={T_HASH}>Hello</T>|{gt('Tides', { $_hash: GT_HASH })}|
      {m(attributedMsg)}|{t('Fog', { $_hash: T_FN_HASH })}|
      {/* Unattributed: hashed at runtime, so no twin carries them */}
      <T>Notice</T>|{gt('Season')}
    </main>
  );
}

type GTGlobals = {
  __generaltranslation?: { reactCore?: { gtContext?: unknown } };
};

/**
 * Resets GT's globals, except the React context: react-core's components and
 * hooks are separate bundles that must keep sharing one context.
 */
function resetGT() {
  const globals = globalThis as GTGlobals;
  const gtContext = globals.__generaltranslation?.reactCore?.gtContext;
  globals.__generaltranslation = gtContext ? { reactCore: { gtContext } } : {};
}

/**
 * What the page module does in a production server build: the compiler
 * registers its attributed entries with an unfilled placeholder.
 */
function registerPageModule() {
  GtInternalRegisterLocaleTwin(
    encodeLocaleTwinPlaceholder({
      [T_HASH]: 'Hello',
      [GT_HASH]: 'Tides',
      [MSG_HASH]: 'Maps',
      [T_FN_HASH]: 'Fog',
    })
  );
}

function initialize(splitting: 'locale' | 'locale-twins') {
  resetGT();
  if (splitting === 'locale-twins') registerPageModule();
  pluginModule.config = {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    files: { gt: { output: 'src/_gt/[locale].json', splitting } },
  };
  pluginModule.loadTranslations = async (locale: string) =>
    locale === 'fr' ? FRENCH : {};
  ensureInitialized();
}

/** Renders the page for a French request through the router integration. */
async function renderFrench(): Promise<string> {
  const router = {
    options: {} as GTRouterOptions,
    history: { location: { state: undefined }, replace: vi.fn() },
    update(next: Partial<GTRouterOptions>) {
      router.options = { ...router.options, ...next };
    },
  };
  setupRouterGTIntegration({ router });
  currentRequest.value = new Request('https://example.com/', {
    headers: { cookie: 'generaltranslation.locale=fr' },
  });
  try {
    // Start dehydrates (loading the request locale) before it renders.
    await router.options.dehydrate?.();
    const Wrap = router.options.Wrap!;
    const html = renderToString(
      <Wrap>
        <Page />
      </Wrap>
    );
    return html.replace(/<!-- -->/g, '');
  } finally {
    currentRequest.value = undefined;
  }
}

describe.sequential('server rendering with locale twins', () => {
  beforeEach(resetGT);

  it('translates every entry without locale twins (control)', async () => {
    initialize('locale');

    await expect(renderFrench()).resolves.toBe(
      '<main>Bonjour|Marées|Cartes|Brouillard|Avis|Saison</main>'
    );
  });

  it('renders unattributed entries in the source locale, like the twins', async () => {
    initialize('locale-twins');

    await expect(renderFrench()).resolves.toBe(
      '<main>Bonjour|Marées|Cartes|Brouillard|Notice|Season</main>'
    );
  });
});
