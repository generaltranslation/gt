import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodePageId, fillSplitTranslations } from '../fillSplitTranslations';
import pageIdEncodings from './pageIdEncodings.json';
import {
  PAGE_HASHES_PLACEHOLDER,
  PAGE_ID_PREFIX,
  SERVER_ONLY_HASHES_PLACEHOLDER,
} from '../../provider/splitTranslationsPlaceholders';

const SERVER = '1111111111111111';
const OTHER_SERVER = '0000000000000000';
const SHARED = '2222222222222222';
const MESSAGE = '3333333333333333';

const PROVIDER = 'server/chunks/provider.js';
const provider = (placeholder: string) =>
  `let a=/x/.exec("${placeholder}"),b='${placeholder}';`;
const filled = (...hashes: string[]) =>
  provider(`__gt_next_server_only_hashes_q7Zk2W__[${hashes.join(',')}]`);

const MAPPED = 'server/chunks/mapped.js';
const sourceMap = (mappings: string) =>
  JSON.stringify({
    version: 3,
    sources: ['mapped.tsx'],
    names: [],
    mappings,
  });

let distDir: string;

function write(file: string, code: string) {
  const target = path.join(distDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, code);
}

const read = (file: string) =>
  fs.readFileSync(path.join(distDir, file), 'utf8');

describe('fillSplitTranslations', () => {
  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-next-split-'));
    write(PROVIDER, provider(SERVER_ONLY_HASHES_PLACEHOLDER));
    write(
      'server/app/page.js',
      `e(T,{children:"Server",_hash:"${SERVER}"});e(T,{_hash:"${SHARED}"});msg({$_hash:"${MESSAGE}"})\`Sent to a client\``
    );
    write('static/chunks/app/page-0a1b.js', `e(T,{_hash:"${SHARED}"})`);
  });
  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('writes the <T> hashes that only server files hold into every placeholder', () => {
    fillSplitTranslations(distDir, false);
    expect(read(PROVIDER)).toBe(filled(SERVER));
  });

  it('reads .mjs and .cjs server files', () => {
    write('server/chunks/x.mjs', `e(T,{_hash:"${OTHER_SERVER}"})`);
    write('server/chunks/x.cjs', `e(T,{_hash:"${MESSAGE}"})`);
    fillSplitTranslations(distDir, false);
    expect(read(PROVIDER)).toBe(filled(OTHER_SERVER, SERVER, MESSAGE));
  });

  it('fills a placeholder an earlier build filled, and writes no file whose content stays', () => {
    fillSplitTranslations(distDir, false);
    const page = path.join(distDir, 'server/app/page.js');
    const untouched = new Date(0);
    fs.utimesSync(page, untouched, untouched);
    fs.utimesSync(path.join(distDir, PROVIDER), untouched, untouched);

    fillSplitTranslations(distDir, false);
    expect(read(PROVIDER)).toBe(filled(SERVER));
    expect(fs.statSync(page).mtime).toEqual(untouched);
    expect(fs.statSync(path.join(distDir, PROVIDER)).mtime).toEqual(untouched);

    write('server/app/other/page.js', `e(T,{_hash:"${OTHER_SERVER}"})`);
    write('static/chunks/1.js', `e(T,{_hash:"${SERVER}"})`);
    fillSplitTranslations(distDir, false);
    expect(read(PROVIDER)).toBe(filled(OTHER_SERVER));
  });

  it('moves what follows the placeholder in the source map beside a file, when filled and filled again', () => {
    write(MAPPED, `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()`);
    // a() at column 0 and b() at column 45, from columns 0 and 10 of line 1
    write(`${MAPPED}.map`, sourceMap('AAAA,6CAAU'));
    fillSplitTranslations(distDir, false);
    // b() 16 columns later
    expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,6DAAU'));

    write('server/app/other/page.js', `e(T,{_hash:"${OTHER_SERVER}"})`);
    fillSplitTranslations(distDir, false);
    // b() 33 columns later
    expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,8EAAU'));
  });

  it.each([
    ['a custom file name', 'mapped.js.symbols.map', 'mapped.js.symbols.map'],
    ['a percent-encoded name', '%5Bmapped%5D.js.map', '[mapped].js.map'],
    ['another directory', '../maps/mapped.js.map', 'server/maps/mapped.js.map'],
  ])(
    'moves the source map the last sourceMappingURL comment names, in %s',
    (_name, url, mapFile) => {
      const mapPath = mapFile.includes('/')
        ? mapFile
        : `server/chunks/${mapFile}`;
      write(
        MAPPED,
        `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()\n//# sourceMappingURL=other.js.map\n//# sourceMappingURL=${url}`
      );
      write(mapPath, sourceMap('AAAA,6CAAU'));
      write(`${MAPPED}.map`, sourceMap('AAAA,6CAAU'));
      fillSplitTranslations(distDir, false);
      expect(read(mapPath)).toBe(sourceMap('AAAA,6DAAU'));
      expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,6CAAU'));
    }
  );

  it('moves an inline source map, and writes it back into its comment', () => {
    const inline = (map: string) =>
      `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(map).toString('base64')}`;
    write(
      MAPPED,
      `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()\n${inline(sourceMap('AAAA,6CAAU'))}`
    );
    fillSplitTranslations(distDir, false);
    expect(read(MAPPED)).toBe(
      `a("__gt_next_server_only_hashes_q7Zk2W__[${SERVER}]");b()\n${inline(sourceMap('AAAA,6DAAU'))}`
    );
  });

  it.each([
    ['outside the build', '../../../outside.js.map'],
    ['at an http URL', 'https://example.com/mapped.js.map'],
  ])('leaves alone a source map a comment names %s', (_name, url) => {
    write(
      MAPPED,
      `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()\n//# sourceMappingURL=${url}`
    );
    write(`${MAPPED}.map`, sourceMap('AAAA,6CAAU'));
    fillSplitTranslations(distDir, false);
    expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,6CAAU'));
  });

  it.each([
    ['version 2', { version: 2, sources: [], mappings: 'AAAA,6CAAU' }],
    [
      'with a section that is an index map',
      {
        version: 3,
        sections: [
          { offset: { line: 0, column: 0 }, map: { version: 3, sections: [] } },
        ],
      },
    ],
  ])('leaves a source map %s alone', (_name, map) => {
    write(MAPPED, `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()`);
    write(`${MAPPED}.map`, JSON.stringify(map));
    fillSplitTranslations(distDir, false);
    expect(read(MAPPED)).toBe(
      `a("__gt_next_server_only_hashes_q7Zk2W__[${SERVER}]");b()`
    );
    expect(read(`${MAPPED}.map`)).toBe(JSON.stringify(map));
  });

  it.each([
    [
      'wrapped in eval',
      'static/chunks/eval.js',
      `eval("e(T,{_hash: \\"${SERVER}\\"})")`,
    ],
    ['outside static/chunks', 'static/other/x.js', `e(T,{_hash:"${SERVER}"})`],
    ['in a .mjs chunk', 'static/chunks/x.mjs', `e(T,{_hash:"${SERVER}"})`],
    ['in a .cjs chunk', 'static/chunks/x.cjs', `e(T,{_hash:"${SERVER}"})`],
  ])(
    'leaves out a hash a client file holds %s',
    (_name, clientFile, clientCode) => {
      write(clientFile, clientCode);
      fillSplitTranslations(distDir, false);
      expect(read(PROVIDER)).toBe(filled());
    }
  );

  it('lists no hash when the build wrote no client file', () => {
    write(PROVIDER, filled(SERVER));
    fs.rmSync(path.join(distDir, 'static'), { recursive: true });
    fillSplitTranslations(distDir, false);
    expect(read(PROVIDER)).toBe(filled());
  });

  it('does nothing when there is no build', () => {
    fs.rmSync(distDir, { recursive: true });
    expect(() => fillSplitTranslations(distDir, false)).not.toThrow();
  });
});

describe('fillSplitTranslations by page', () => {
  const ROOT = 'static/chunks/root.js';
  const LAYOUT_T = 'aaaaaaaaaaaaaaaa';
  const HOME = 'static/chunks/home.js';
  const HOME_T = 'bbbbbbbbbbbbbbbb';
  const ORDERS = 'static/chunks/orders.js';
  const ORDERS_T = 'cccccccccccccccc';
  const ORDERS_MESSAGE = 'dddddddddddddddd';
  const SHARED_T = 'eeeeeeeeeeeeeeee';
  const LAZY_T = 'ffffffffffffffff';
  const ORDERS_LAZY = 'static/chunks/orders-lazy.js';
  const ORDERS_LAZY_T = '1212121212121212';
  const ERROR = 'static/chunks/orders-error.js';
  const ERROR_T = '3434343434343434';
  const CART = 'static/chunks/cart.js';
  const CART_T = '5656565656565656';
  const CLIENT_PAGE = 'static/chunks/client-page.js';
  const CLIENT_PAGE_T = '7878787878787878';
  const PROJECT = '[project]/apps/web/';
  const PAGE_HASHES = 'server/chunks/ssr/runtime.js';
  const ORDERS_SERVER = 'server/chunks/ssr/orders.js';
  const pageHashes = (placeholder: string) =>
    `let p=/x/.exec('${placeholder}');`;
  const segment = (id: string, file = `apps/web/${id}`) =>
    `e(GtSegment,{id:"${PAGE_ID_PREFIX}${id}",file:"${file}"});`;

  /**
   * Writes a route as Turbopack does: its client reference manifest, its
   * entry, and the trace of the server files the entry loads.
   */
  function writeRoute(
    route: string,
    entries: Record<string, string[]>,
    serverFiles: string[],
    project = PROJECT
  ) {
    const entry = `server/app${route}.js`;
    write(
      `server/app${route}_client-reference-manifest.js`,
      `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST[${JSON.stringify(route)}] = ${JSON.stringify(
        {
          clientModules: {},
          entryJSFiles: Object.fromEntries(
            Object.entries(entries).map(([entry, files]) => [
              project + entry,
              [ROOT, ...files],
            ])
          ),
        }
      )};`
    );
    write(entry, serverFiles.map((file) => `R.c("${file}")`).join('\n'));
    write(
      `${entry}.nft.json`,
      JSON.stringify({
        version: 1,
        files: [PAGE_HASHES, ...serverFiles].map((file) =>
          path.posix.relative(path.posix.dirname(entry), file)
        ),
      })
    );
  }

  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-next-split-'));
    write(PAGE_HASHES, pageHashes(PAGE_HASHES_PLACEHOLDER));
    write('server/chunks/ssr/home.js', segment('app/page'));
    write(ORDERS_SERVER, segment('app/orders/page'));
    write('server/chunks/ssr/cart.js', segment('app/%28shop%29/cart/page'));
    write(ROOT, `e(T,{_hash:"${LAYOUT_T}"})`);
    write(HOME, `e(T,{_hash:"${HOME_T}"})`);
    write(
      ORDERS,
      `e(T,{_hash:"${ORDERS_T}"});e(T,{_hash:"${SHARED_T}"});e(T,{_hash:"${LAZY_T}"});t({$_hash:"${ORDERS_MESSAGE}"});e(T,{_hash:"${LAYOUT_T}"})`
    );
    write(ORDERS_LAZY, `e(T,{_hash:"${ORDERS_LAZY_T}"})`);
    write('static/chunks/lazy.js', `e(T,{_hash:"${LAZY_T}"})`);
    write(
      'static/chunks/loader.js',
      'Promise.all(["static/chunks/orders-lazy.js"].map(load))'
    );
    write(ERROR, `e(T,{_hash:"${ERROR_T}"})`);
    write(CART, `e(T,{_hash:"${CART_T}"});e(T,{_hash:"${SHARED_T}"})`);
    write(CLIENT_PAGE, `e(T,{_hash:"${CLIENT_PAGE_T}"})`);
    writeRoute('/page', { 'app/layout': [], 'app/page': [HOME] }, [
      'server/chunks/ssr/home.js',
    ]);
    writeRoute(
      '/orders/page',
      {
        'app/layout': [],
        'app/orders/page': [ORDERS, ORDERS_LAZY],
        'app/orders/error': [ERROR],
      },
      [ORDERS_SERVER]
    );
    writeRoute(
      '/(shop)/cart/page',
      { 'app/layout': [], 'app/(shop)/cart/page': [CART] },
      ['server/chunks/ssr/cart.js']
    );
    writeRoute(
      '/client/page',
      { 'app/layout': [], 'app/client/page': [CLIENT_PAGE] },
      ['server/chunks/ssr/client.js']
    );
    write('server/chunks/ssr/client.js', '');
  });
  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  const placed = (...pages: [string, string[]][]) =>
    pageHashes(
      `__gt_next_page_hashes_q7Zk2W__[${pages
        .map(([id, hashes]) => `${id}:${hashes.join(',')}`)
        .join(';')}]`
    );

  const WITHOUT_ORDERS = placed(
    ['app/%28shop%29/cart/page', [CART_T]],
    ['app/page', [HOME_T]]
  );

  const expected = placed(
    ['app/%28shop%29/cart/page', [CART_T]],
    ['app/orders/page', [ORDERS_T]],
    ['app/page', [HOME_T]]
  );

  it('places with a wrapped page the <T> hashes only its own entry loads', () => {
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(expected);
  });

  it('moves the source map of a file with both placeholders on one line', () => {
    write(
      MAPPED,
      `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b("${PAGE_HASHES_PLACEHOLDER}");c();e(T,{_hash:"9999999999999999"})`
    );
    // a(), b() and c() at columns 0, 45 and 83, from columns 0, 10 and 20 of line 1
    write(`${MAPPED}.map`, sourceMap('AAAA,6CAAU,sCAAU'));
    fillSplitTranslations(distDir, true);
    // b() 16 columns later, after one hash, and c() 116, after the pages too
    expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,6DAAU,0IAAU'));
  });

  it('places nothing when the build did not wrap pages', () => {
    fillSplitTranslations(distDir, true);
    fillSplitTranslations(distDir, false);
    expect(read(PAGE_HASHES)).toBe(placed());
  });

  it('fills a placeholder an earlier build filled', () => {
    fillSplitTranslations(distDir, true);
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(expected);

    write(ORDERS_SERVER, '');
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(WITHOUT_ORDERS);
  });

  it.each([
    ['in a comment', `/* ${PAGE_ID_PREFIX}app/orders/page */`],
    ['as a longer id', segment('app/orders/page/x')],
    ['in another prop', `e(X,{title:"${PAGE_ID_PREFIX}app/orders/page"})`],
    [
      'without its file',
      `e(GtSegment,{id:"${PAGE_ID_PREFIX}app/orders/page"});`,
    ],
    [
      "with another file's name",
      segment('app/orders/page', 'apps/web/app/other/page'),
    ],
  ])(
    'places nothing with a page whose route holds its id only %s',
    (_name, code) => {
      write(ORDERS_SERVER, code);
      fillSplitTranslations(distDir, true);
      expect(read(PAGE_HASHES)).toBe(WITHOUT_ORDERS);
    }
  );

  // In a project directory named app under the Turbopack root, the plugin
  // declines the ambiguous app/app/orders/page.tsx and reads the helper
  // app/orders/page.tsx that page imports as the /orders page.
  it.each([
    [
      'places nothing by the GtSegment of a helper file read as a page',
      'app/orders/page',
      WITHOUT_ORDERS,
    ],
    [
      'places by the GtSegment of the page itself',
      'app/app/orders/page',
      expected,
    ],
  ])('in a project directory named app, %s', (_name, file, result) => {
    const project = '[project]/app/';
    writeRoute(
      '/page',
      { 'app/layout': [], 'app/page': [HOME] },
      ['server/chunks/ssr/home.js'],
      project
    );
    writeRoute(
      '/orders/page',
      {
        'app/layout': [],
        'app/orders/page': [ORDERS, ORDERS_LAZY],
        'app/orders/error': [ERROR],
      },
      [ORDERS_SERVER],
      project
    );
    writeRoute(
      '/(shop)/cart/page',
      { 'app/layout': [], 'app/(shop)/cart/page': [CART] },
      ['server/chunks/ssr/cart.js'],
      project
    );
    writeRoute(
      '/client/page',
      { 'app/layout': [], 'app/client/page': [CLIENT_PAGE] },
      ['server/chunks/ssr/client.js'],
      project
    );
    write('server/chunks/ssr/home.js', segment('app/page', 'app/app/page'));
    write(
      'server/chunks/ssr/cart.js',
      segment('app/%28shop%29/cart/page', 'app/app/%28shop%29/cart/page')
    );
    write(ORDERS_SERVER, segment('app/orders/page', file));
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(result);
  });

  it("places nothing with a page whose GtSegment is outside its route's files", () => {
    write(ORDERS_SERVER, '');
    write('server/chunks/ssr/stale.js', segment('app/orders/page'));
    write('server/app/page.js', segment('app/orders/page'));
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(WITHOUT_ORDERS);
  });

  it('places nothing with a page another route renders without its GtSegment', () => {
    writeRoute(
      '/photos/page',
      { 'app/layout': [], 'app/orders/page': [ORDERS] },
      ['server/chunks/ssr/photos.js']
    );
    write('server/chunks/ssr/photos.js', '');
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(WITHOUT_ORDERS);
  });

  it('places nothing with a page whose route has no trace', () => {
    fs.rmSync(path.join(distDir, 'server/app/orders/page.js.nft.json'));
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(WITHOUT_ORDERS);
  });

  it('places nothing from a chunk whose name a client chunk holds, its own included', () => {
    write(ORDERS, `${read(ORDERS)};load("orders.js")`);
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(WITHOUT_ORDERS);
  });

  it('places a <T> hash that the first of its page chunks holds only as a bare token', () => {
    write('static/chunks/a.js', `x="${ORDERS_T}"`);
    writeRoute(
      '/orders/page',
      { 'app/layout': [], 'app/orders/page': ['static/chunks/a.js', ORDERS] },
      [ORDERS_SERVER]
    );
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(expected);
  });

  it('places nothing when the manifests list no entries, as under webpack', () => {
    write(
      'server/app/orders/page_client-reference-manifest.js',
      `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/orders/page"] = {"clientModules":{}};`
    );
    fillSplitTranslations(distDir, true);
    expect(read(PAGE_HASHES)).toBe(placed());
  });

  it.each(pageIdEncodings)(
    'encodes the page id %s as the SWC plugin does',
    (id, encoded) => {
      expect(encodePageId(id)).toBe(encoded);
    }
  );
});
