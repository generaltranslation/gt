import path from 'node:path';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { CHUNK_TRANSLATIONS_GLOBAL } from './resolveChunkTranslations';

/** What the startup script is given; `ChunkTranslationsState` in gt-react. */
export type StartupState = {
  /** The URL the build's files are served from */
  b: string;
  /**
   * The key of the entry's file: the entry chunk's file without its
   * extension, or in a build that names each file by its own hash, the key
   * of every file that holds translations
   */
  f: string;
  /** The hash in the name of the entry's file, by locale */
  h: Record<string, string>;
  /** The token in the name of every other file of a locale, by locale */
  v: Record<string, string>;
  /** The locale the script read, when it has a file */
  l?: string;
  /** The entry's file it requested, by locale */
  p?: Record<string, Promise<unknown>>;
  /** The files of preloaded chunks it requested, by locale and key */
  g?: Record<string, Promise<unknown>>;
  /** The files gt-react has requested itself, by locale and key */
  r?: Record<string, unknown>;
};

/**
 * Runs in the page, before any module: reads the locale and requests the
 * entry's translations while the HTML is still being parsed. It is written
 * out with `toString()`, so it uses nothing outside its own body, and no
 * syntax newer than ES2019, which this package's build leaves as written.
 *
 * The locale is the cookie gt-react keeps, which holds the locale it resolved
 * on an earlier visit. On a first visit it is the browser's first language
 * that is a configured locale, or shares its language with one. gt-react
 * resolves the locale itself once it runs and requests the file again if this
 * guess was wrong.
 */
function startChunkTranslations(
  state: StartupState,
  locales: string[],
  localeCookie: string,
  enableI18nCookie: string,
  globalName: string
): void {
  const read = (name: string): string | undefined => {
    for (const part of document.cookie.split(';')) {
      const cookie = part.trim();
      if (cookie.indexOf(name + '=') === 0) {
        const value = cookie.slice(name.length + 1);
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      }
    }
    return undefined;
  };
  let locale: string | undefined;
  for (const value of [read(localeCookie)].concat(navigator.languages || [])) {
    const candidate = (value || '').toLowerCase();
    let sameLanguage: string | undefined;
    for (const known of candidate ? locales : []) {
      const lowered = known.toLowerCase();
      if (lowered === candidate) {
        locale = known;
        break;
      }
      if (!sameLanguage && lowered.split('-')[0] === candidate.split('-')[0]) {
        sameLanguage = known;
      }
    }
    locale = locale || sameLanguage;
    if (locale) break;
  }
  if (locale && state.h[locale] && read(enableI18nCookie) !== 'false') {
    const request = fetch(
      state.b + state.f + '.' + locale + '.' + state.h[locale] + '.json'
    ).then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
    // gt-react reports a failure when it reads the request
    request.catch(() => {});
    state.l = locale;
    state.p = { [locale]: request };
  }
  (window as unknown as Record<string, StartupState>)[globalName] = state;
}

// Bits a key sets in the filter, and bits the filter has per key: about one
// key in 150 that has no file passes for one that has
const FILTER_PROBES = 4;
const FILTER_BITS_PER_KEY = 12;
// A filter of a few keys costs little to make nearly exact
const MIN_FILTER_BYTES = 32;

/**
 * Where a key's bits are in a filter of `size` bits. The build sets them and
 * the page tests them, with this one function.
 */
function getFilterBits(key: string, size: number, probes: number): number[] {
  let first = 0x811c9dc5;
  let step = 0x9747b28c;
  for (let index = 0; index < key.length; index++) {
    first = Math.imul(first ^ key.charCodeAt(index), 0x01000193);
    step = Math.imul(step ^ key.charCodeAt(index), 0x5bd1e995);
  }
  const bits = [];
  for (let probe = 0; probe < probes; probe++) {
    bits.push(((first >>> 0) + probe * ((step | 1) >>> 0)) % size);
  }
  return bits;
}

/**
 * Which keys have a file, as a filter the page can test a key against
 * without holding every key: base64 of its bits. It answers yes for every
 * key given here and, rarely, for another.
 */
export function createKeyFilter(keys: string[]): string {
  const bytes = new Uint8Array(
    Math.max(
      MIN_FILTER_BYTES,
      Math.ceil((keys.length * FILTER_BITS_PER_KEY) / 8)
    )
  );
  for (const key of keys) {
    for (const bit of getFilterBits(key, bytes.length * 8, FILTER_PROBES)) {
      bytes[bit >> 3] |= 1 << (bit & 7);
    }
  }
  return Buffer.from(bytes).toString('base64');
}

/**
 * Runs right after: requests the file of each chunk the page preloads with a
 * `modulepreload` link, as a server adds them for the chunks of the route it
 * serves, so those files load while the HTML is parsed and not once the app
 * imports the route. gt-react reads these requests when the import runs.
 *
 * A file's URL is the chunk's, with the locale and the locale's token in
 * place of the extension, so nothing else has to arrive first. Links can be
 * anywhere in the page: those after the script are seen as the parser adds
 * them. A chunk's key is the rest of its URL after the build's base, and a
 * link to anything else is passed over. The filter says which chunks have a
 * file; the rare chunk it is wrong about costs one request next to the
 * chunk, which finds nothing and which nothing reads.
 *
 * A dynamic import that runs while the page loads adds such links too, for
 * the chunks it loads. gt-react has requested their files by then, and they
 * are not requested again.
 */
function startPreloadedTranslations(
  state: StartupState,
  filter: string,
  probes: number,
  getBits: (key: string, size: number, probes: number) => number[]
): void {
  const locale = state.l;
  const token = locale && state.v[locale];
  if (!locale || !token) return;
  const bits = atob(filter);
  const base = new URL(state.b, document.baseURI).href;
  const requested: Record<string, Promise<unknown>> = (state.g = {});
  const request = (link: HTMLLinkElement): void => {
    if (link.rel !== 'modulepreload' || link.href.indexOf(base) !== 0) return;
    const key = link.href
      .slice(base.length)
      .split(/[?#]/)[0]
      .replace(/\.[cm]?js$/, '');
    if (
      getBits(key, bits.length * 8, probes).some(
        (bit) => !(bits.charCodeAt(bit >> 3) & (1 << (bit & 7)))
      )
    ) {
      return;
    }
    const id = locale + ' ' + key;
    if (!requested[id] && !(state.r && state.r[id])) {
      const file = fetch(
        state.b + key + '.' + locale + '.' + token + '.json'
      ).then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
      // gt-react reports a failure when it reads the request
      file.catch(() => {});
      requested[id] = file;
    }
  };
  document.querySelectorAll('link').forEach(request);
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeName === 'LINK') request(node as HTMLLinkElement);
      });
    }
  });
  observer.observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => observer.disconnect());
}

/**
 * Runs right after in a build that names each file by its own hash, in place
 * of the function above: requests the locale's map of those hashes, and once
 * it has arrived, the file of each chunk the page preloads that the map
 * lists. gt-react reads the map and those requests. The files of preloaded
 * chunks therefore start one round trip after the page does.
 *
 * Such a file is named like the entry's, by the entry's key, the locale and
 * its hash, and chunks whose files hold the same have one file, which is
 * requested once.
 */
function startMappedTranslations(
  state: StartupState & {
    /** The key of the maps */
    k?: string;
    /** The map requested, by locale */
    m?: Record<string, Promise<unknown>>;
  },
  key: string
): void {
  state.k = key;
  const locale = state.l;
  const token = locale && state.v[locale];
  if (!locale || !token) return;
  const map: Promise<{ i?: { k: string[]; h?: (string | 0)[] } }> = fetch(
    state.b + key + '.' + locale + '.' + token + '.json'
  ).then((response) => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  });
  state.m = { [locale]: map };
  const requested: Record<string, Promise<unknown>> = (state.g = {});
  map
    .then((file) => {
      const listed = file.i;
      const hashes = listed && listed.h;
      if (!hashes) return;
      const request = (link: HTMLLinkElement): void => {
        if (link.rel !== 'modulepreload') return;
        const path = link.href
          .split(/[?#]/)[0]
          .replace(/\.[cm]?js$/, '')
          .split('/');
        // After the origin, the longest end of the path that is a key
        for (let start = 3; start < path.length; start++) {
          const hash = hashes[listed.k.indexOf(path.slice(start).join('/'))];
          if (!hash) continue;
          const id = locale + ' ' + hash;
          if (!requested[id] && !(state.r && state.r[id])) {
            const translations = fetch(
              state.b + state.f + '.' + locale + '.' + hash + '.json'
            ).then((response) => {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            });
            translations.catch(() => {});
            requested[id] = translations;
          }
          return;
        }
      };
      document.querySelectorAll('link').forEach(request);
      if (document.readyState !== 'loading') return;
      const observer = new window.MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (node.nodeName === 'LINK') request(node as HTMLLinkElement);
          });
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', () =>
        observer.disconnect()
      );
    })
    // gt-react reports a failure when it reads the map
    .catch(() => {});
}

/**
 * Runs right after, in a build with unsplit files (see
 * unsplitTranslations.ts): also requests the unsplit file of the locale the
 * script read, which the loader of those files then reads.
 */
function startUnsplitTranslations(
  state: StartupState & {
    /** The key of the unsplit file */
    u?: string;
    /** The hash in the name of the unsplit file, by locale */
    o?: Record<string, string>;
    /** The unsplit files requested, by locale */
    q?: Record<string, Promise<unknown>>;
  },
  key: string,
  hashes: Record<string, string>
): void {
  state.u = key;
  state.o = hashes;
  const locale = state.l;
  if (locale && hashes[locale]) {
    const request = fetch(
      state.b + key + '.' + locale + '.' + hashes[locale] + '.json'
    ).then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
    // The loader reports a failure when it reads the request
    request.catch(() => {});
    state.q = { [locale]: request };
  }
}

/**
 * The base a page's startup script is given. Vite's relative base (`./` or
 * empty) is relative to each page it writes, as the URLs it writes into the
 * page are, so a page in a directory gets the way up from there.
 * @param page The page's path from the build's root, as `/nested/index.html`.
 */
export function getPageBase(base: string, page: string): string {
  if (base !== './' && base !== '') return base;
  return `${path.posix.relative(path.posix.dirname(page), '/') || '.'}/`;
}

// A `<` in data must not end the script element
function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** A function of this file as the page gets it. */
function printFunction(run: (...data: never[]) => unknown): string {
  return `(${
    generate(parser.parseExpression(`(${run.toString()})`), {
      minified: true,
      comments: false,
    }).code
  })`;
}

/** A call of a function of this file with data, as a statement of the script. */
function renderCall(run: (...data: never[]) => void, data: string[]): string {
  return `${printFunction(run)}(${data.join(',')});`;
}

/**
 * The script a page runs before its modules.
 *
 * @param locales The default locale and every configured one, in which the locale is looked for.
 * @param tokens The token in the name of every file but the entry's, by locale; with `maps`, the hash in the name of each locale's map.
 * @param files The keys of those files, whose chunks the script requests them for when the page preloads the chunks.
 * @param maps The key of the maps, in a build that names each file by its own hash.
 * @param unsplit The key of the build's unsplit files and the hash in the name of each locale's, when it has any.
 */
export function renderStartupScript({
  base,
  entry,
  hashes,
  tokens,
  files = [],
  maps,
  locales,
  unsplit,
}: {
  base: string;
  entry: string;
  hashes: Record<string, string>;
  tokens: Record<string, string>;
  files?: string[];
  maps?: { key: string };
  locales: string[];
  unsplit?: { key: string; hashes: Record<string, string> };
}): string {
  const state: StartupState = { b: base, f: entry, h: hashes, v: tokens };
  const shared = `window[${toScriptJson(CHUNK_TRANSLATIONS_GLOBAL)}]`;
  // A relative base is relative to the page as it loads, and the app can change the page's URL
  const resolved =
    base === '' || base.startsWith('.')
      ? `Object.assign(${toScriptJson(state)},{b:new URL(${toScriptJson(base || '.')},document.baseURI).href})`
      : toScriptJson(state);
  return [
    renderCall(startChunkTranslations, [
      resolved,
      ...[
        locales,
        defaultLocaleCookieName,
        defaultEnableI18nCookieName,
        CHUNK_TRANSLATIONS_GLOBAL,
      ].map(toScriptJson),
    ]),
    maps
      ? renderCall(startMappedTranslations, [shared, toScriptJson(maps.key)])
      : '',
    files.length
      ? renderCall(startPreloadedTranslations, [
          shared,
          toScriptJson(createKeyFilter(files)),
          toScriptJson(FILTER_PROBES),
          printFunction(getFilterBits),
        ])
      : '',
    unsplit
      ? renderCall(startUnsplitTranslations, [
          shared,
          toScriptJson(unsplit.key),
          toScriptJson(unsplit.hashes),
        ])
      : '',
  ].join('');
}
