import fs from 'node:fs';
import path from 'node:path';
import {
  findHashTokens,
  findJsxHashes,
} from '@generaltranslation/compiler/internal';
import {
  PAGE_HASHES_PLACEHOLDER,
  PAGE_ID_PREFIX,
  SERVER_ONLY_HASHES_PLACEHOLDER,
} from '../provider/splitTranslationsPlaceholders';
import { fillCompiledFile } from './fillCompiledFile';

const [SERVER_ONLY_HASHES_NAME] = SERVER_ONLY_HASHES_PLACEHOLDER.split('[');
const [PAGE_HASHES_NAME] = PAGE_HASHES_PLACEHOLDER.split('[');

// A bundler can leave a chunk of an earlier build in place, so an already
// filled placeholder is filled again.
const SERVER_ONLY_HASHES = new RegExp(
  `${SERVER_ONLY_HASHES_NAME}\\[[0-9a-f,]*\\]`,
  'g'
);
const PAGE_HASHES = new RegExp(`${PAGE_HASHES_NAME}\\[[\\w%/.:,;-]*\\]`, 'g');

type ClientReferenceManifest = { entryJSFiles?: Record<string, string[]> };

type RouteManifest = {
  /** The `_client-reference-manifest.js` file of the route's entry. */
  file: string;
  route: string;
  manifest: ClientReferenceManifest;
};

function findJsFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return findJsFiles(file);
    return /\.[cm]?js$/.test(entry.name) ? [file] : [];
  });
}

/**
 * Percent-encodes every byte but `A-Z a-z 0-9 / _ . -`, as the SWC plugin
 * encodes the page ids it writes.
 */
export function encodePageId(id: string): string {
  return Array.from(new TextEncoder().encode(id), (byte) => {
    const character = String.fromCharCode(byte);
    return /[\w/.-]/.test(character)
      ? character
      : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }).join('');
}

const TURBOPACK_PROJECT = '[project]/';

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The id and file props as the SWC plugin writes them for the page whose
 * Turbopack entry is `entry`, or undefined for an entry outside the project:
 * the file the plugin compiled must be the entry's own, whatever page id it
 * guessed, and a comment or another string naming the page does not count.
 */
function segmentPattern(encodedId: string, entry: string): RegExp | undefined {
  if (!entry.startsWith(TURBOPACK_PROJECT)) return undefined;
  const id = escapeRegExp(`${PAGE_ID_PREFIX}${encodedId}`);
  const file = escapeRegExp(
    encodePageId(entry.slice(TURBOPACK_PROJECT.length))
  );
  return new RegExp(`\\bid:\\s*(["'])${id}\\1,\\s*file:\\s*(["'])${file}\\2`);
}

function readRouteManifests(distDir: string): RouteManifest[] {
  return findJsFiles(path.join(distDir, 'server', 'app'))
    .filter((file) => file.endsWith('_client-reference-manifest.js'))
    .flatMap((file) => {
      const manifests: Record<string, ClientReferenceManifest> = {};
      new Function('globalThis', fs.readFileSync(file, 'utf8'))({
        __RSC_MANIFEST: manifests,
      });
      return Object.entries(manifests).map(([route, manifest]) => ({
        file,
        route,
        manifest,
      }));
    });
}

/**
 * The page ids of Turbopack's entries by their keys, which name the file of
 * the entry from a root that only the key of each route's own page entry
 * shows.
 */
function findPageIds(routes: RouteManifest[]): Map<string, string> {
  const prefixes = new Set<string>();
  for (const { route, manifest } of routes) {
    if (!manifest.entryJSFiles) return new Map();
    const suffix = `/app${route}`;
    const key = Object.keys(manifest.entryJSFiles).find((key) =>
      key.endsWith(suffix)
    );
    if (key) prefixes.add(key.slice(0, -suffix.length + 1));
  }
  if (prefixes.size !== 1) return new Map();
  const [prefix] = Array.from(prefixes);
  const pageIds = new Map<string, string>();
  for (const { manifest } of routes) {
    for (const key of Object.keys(manifest.entryJSFiles!)) {
      const id = key.slice(prefix.length);
      if (key.startsWith(prefix) && /^app(\/.+)?\/page$/.test(id)) {
        pageIds.set(key, encodePageId(id));
      }
    }
  }
  return pageIds;
}

/**
 * The pages whose GtSegment is in the server files of every route that
 * renders them: the route's entry and the files its trace lists.
 */
function findWrappedPages(
  distDir: string,
  routes: RouteManifest[],
  pageIds: Map<string, string>
): Set<string> {
  const serverDir = path.join(distDir, 'server') + path.sep;
  const codeByFile = new Map<string, string>();
  const read = (file: string) => {
    if (!codeByFile.has(file)) {
      codeByFile.set(file, fs.readFileSync(file, 'utf8'));
    }
    return codeByFile.get(file)!;
  };
  const wrapped = new Set<string>();
  const unwrapped = new Set<string>();
  for (const { file, manifest } of routes) {
    const entry = file.replace(/_client-reference-manifest\.js$/, '.js');
    const trace = `${entry}.nft.json`;
    const traced: string[] = fs.existsSync(trace)
      ? (JSON.parse(read(trace)) as { files: string[] }).files.map((traced) =>
          path.resolve(path.dirname(trace), traced)
        )
      : [];
    const routeFiles = [entry, ...traced].filter(
      (routeFile) =>
        routeFile.startsWith(serverDir) &&
        /\.[cm]?js$/.test(routeFile) &&
        fs.existsSync(routeFile)
    );
    for (const key of Object.keys(manifest.entryJSFiles ?? {})) {
      const id = pageIds.get(key);
      if (!id) continue;
      const segment = segmentPattern(id, key);
      const found =
        segment !== undefined &&
        routeFiles.some((routeFile) => segment.test(read(routeFile)));
      (found ? wrapped : unwrapped).add(id);
    }
  }
  unwrapped.forEach((id) => wrapped.delete(id));
  return wrapped;
}

/**
 * The <T> hashes to send with each wrapped page: those whose every client
 * file only that page's entry loads.
 */
function placePageHashes(
  distDir: string,
  clientCode: Map<string, string>,
  filesByHash: Map<string, string[]>
): Map<string, string[]> {
  const routes = readRouteManifests(distDir);
  const pageIds = findPageIds(routes);
  const wrappedPages = findWrappedPages(distDir, routes, pageIds);

  const entriesByFile = new Map<string, Set<string>>();
  for (const { manifest } of routes) {
    for (const [entry, files] of Object.entries(manifest.entryJSFiles ?? {})) {
      for (const file of files) {
        const entries = entriesByFile.get(file) ?? new Set();
        entriesByFile.set(file, entries.add(entry));
      }
    }
  }
  const pageOf = (file: string) => {
    const entries = entriesByFile.get(file);
    if (entries?.size !== 1) return undefined;
    const [entry] = Array.from(entries);
    const id = pageIds.get(entry);
    if (!id || !wrappedPages.has(id)) return undefined;
    // A chunk another chunk names can be loaded lazily, by any page.
    const name = path.posix.basename(file);
    const loadedLazily = Array.from(clientCode.values()).some((code) =>
      code.includes(name)
    );
    return loadedLazily ? undefined : id;
  };
  const pageByFile = new Map(
    Array.from(clientCode.keys(), (file) => [file, pageOf(file)])
  );

  const jsxHashes = new Set(
    Array.from(clientCode.values()).flatMap((code) => findJsxHashes(code))
  );
  const hashesByPage = new Map<string, string[]>();
  jsxHashes.forEach((hash) => {
    const [first, ...others] = filesByHash.get(hash) ?? [];
    const page = first && pageByFile.get(first);
    if (!page || others.some((file) => pageByFile.get(file) !== page)) return;
    hashesByPage.set(page, [...(hashesByPage.get(page) ?? []), hash]);
  });
  return hashesByPage;
}

/**
 * Writes into the placeholders of the compiled server files the <T> hashes in
 * server output that no browser output holds, and, when the SWC plugin
 * wrapped the pages of this build in GtSegment, those each page sends itself.
 */
export function fillSplitTranslations(
  distDir: string,
  wrapsPages: boolean
): void {
  const clientCode = new Map(
    findJsFiles(path.join(distDir, 'static')).map((file) => [
      path.relative(distDir, file).split(path.sep).join('/'),
      fs.readFileSync(file, 'utf8'),
    ])
  );
  const filesByHash = new Map<string, string[]>();
  clientCode.forEach((code, file) => {
    new Set(findHashTokens(code)).forEach((hash) => {
      filesByHash.set(hash, [...(filesByHash.get(hash) ?? []), file]);
    });
  });
  const serverOnlyHashes = new Set<string>();
  const placeholderFiles: string[] = [];
  for (const file of findJsFiles(path.join(distDir, 'server'))) {
    const code = fs.readFileSync(file, 'utf8');
    // A msg() made in server code carries its $_hash to a client m(), so only
    // <T> hashes are listed.
    for (const hash of findJsxHashes(code)) {
      if (!filesByHash.has(hash)) serverOnlyHashes.add(hash);
    }
    if (
      code.includes(SERVER_ONLY_HASHES_NAME) ||
      code.includes(PAGE_HASHES_NAME)
    ) {
      placeholderFiles.push(file);
    }
  }

  const hashes = clientCode.size ? Array.from(serverOnlyHashes).sort() : [];
  const pages = wrapsPages
    ? Array.from(placePageHashes(distDir, clientCode, filesByHash))
    : [];
  const fills: [pattern: RegExp, filled: string][] = [
    [SERVER_ONLY_HASHES, `${SERVER_ONLY_HASHES_NAME}[${hashes.join(',')}]`],
    [
      PAGE_HASHES,
      `${PAGE_HASHES_NAME}[${pages
        .map(([id, pageHashes]) => `${id}:${pageHashes.sort().join(',')}`)
        .sort()
        .join(';')}]`,
    ],
  ];
  for (const file of placeholderFiles) fillCompiledFile(distDir, file, fills);
}
