import { describe, expect, it } from 'vitest';
import { defaultLocaleCookieName } from '../../utils/cookieNames';
import {
  createLocaleTwinDocumentMarkup,
  type LocaleTwinDocumentData,
} from '../document';
import {
  createLocaleTwinDocument,
  getLocaleTwinAssetHeaders,
  getLocaleTwinDocumentHeaders,
  resolveLocaleTwinLocale,
} from '../serving';

const DATA: LocaleTwinDocumentData = {
  version: 1,
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es', 'ja'],
  localeCookieName: defaultLocaleCookieName,
  tags: [
    {
      tag: 'script',
      attributes: { type: 'module', crossorigin: '' },
      urls: {
        en: '/assets/index-A.en-11111111.js',
        fr: '/assets/index-A.fr-22222222.js',
        es: '/assets/index-A.es-33333333.js',
        ja: '/assets/index-A.ja-44444444.js',
      },
    },
    {
      tag: 'link',
      attributes: { rel: 'modulepreload', crossorigin: '' },
      urls: {
        en: '/assets/page-B.en-11111111.js',
        fr: '/assets/page-B.fr-22222222.js',
        es: '/assets/page-B.es-33333333.js',
        ja: '/assets/page-B.ja-44444444.js',
      },
    },
  ],
};

/** A built document as the compiler writes it (inline bootstrap by default). */
function builtHtml(
  data: LocaleTwinDocumentData = DATA,
  bootstrap?: { src: string }
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>App</title>
    ${createLocaleTwinDocumentMarkup(data, bootstrap)}
    <link rel="modulepreload" crossorigin href="/assets/vendor-C.js">
    <link rel="stylesheet" crossorigin href="/assets/index-D.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
}

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/', { headers });
}

describe('resolveLocaleTwinLocale', () => {
  const options = { defaultLocale: 'en', locales: ['en', 'fr', 'es', 'ja'] };

  it('prefers the locale cookie, then Accept-Language, then the default', () => {
    expect(
      resolveLocaleTwinLocale(
        request({
          cookie: `${defaultLocaleCookieName}=es`,
          'accept-language': 'fr',
        }),
        options
      )
    ).toBe('es');
    expect(
      resolveLocaleTwinLocale(
        request({ 'accept-language': 'de;q=0.9, ja-JP;q=0.8' }),
        options
      )
    ).toBe('ja');
    expect(
      resolveLocaleTwinLocale(request({ 'accept-language': 'de' }), options)
    ).toBe('en');
    expect(resolveLocaleTwinLocale(request(), options)).toBe('en');
  });

  it('skips a cookie for an unknown locale', () => {
    expect(
      resolveLocaleTwinLocale(
        request({
          cookie: `${defaultLocaleCookieName}=de`,
          'accept-language': 'fr-CA',
        }),
        options
      )
    ).toBe('fr');
  });

  it('reads a custom cookie name from Headers or a plain header record', () => {
    const custom = { ...options, localeCookieName: 'my-locale' };
    expect(
      resolveLocaleTwinLocale(
        new Headers({ cookie: `${defaultLocaleCookieName}=fr; my-locale=ja` }),
        custom
      )
    ).toBe('ja');
    expect(
      resolveLocaleTwinLocale(
        { cookie: 'my-locale=es', 'accept-language': ['fr'] },
        custom
      )
    ).toBe('es');
    expect(resolveLocaleTwinLocale({ 'Accept-Language': 'fr' }, custom)).toBe(
      'fr'
    );
  });
});

describe('createLocaleTwinDocument', () => {
  it("renders the document with the locale's twins and lang, without the bootstrap", () => {
    const document = createLocaleTwinDocument({ html: builtHtml() });

    expect(document.locales).toEqual(['en', 'fr', 'es', 'ja']);
    expect(document.defaultLocale).toBe('en');
    expect(document.render('fr')).toBe(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>App</title>
    <script type="module" crossorigin src="/assets/index-A.fr-22222222.js"></script><link rel="modulepreload" crossorigin href="/assets/page-B.fr-22222222.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-C.js">
    <link rel="stylesheet" crossorigin href="/assets/index-D.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`);
  });

  it('renders the default locale for a locale without twins', () => {
    const document = createLocaleTwinDocument({ html: builtHtml() });
    expect(document.render('de')).toContain('index-A.en-11111111.js');
    expect(document.render('fr-CA')).toContain('index-A.fr-22222222.js');
  });

  it('removes an external bootstrap too and adds lang when missing', () => {
    const html = builtHtml(DATA, {
      src: '/assets/gt-locale-twins-bootstrap.abcdef12.js',
    }).replace('<html lang="en">', '<html>');
    const rendered = createLocaleTwinDocument({ html }).render('ja');

    expect(rendered).toContain('<html lang="ja">');
    expect(rendered).not.toContain('gt-locale-twins');
    expect(rendered).toContain(
      '<script type="module" crossorigin src="/assets/index-A.ja-44444444.js"></script>'
    );
  });

  it('escapes attribute values', () => {
    const data: LocaleTwinDocumentData = {
      ...DATA,
      locales: ['en'],
      tags: [
        {
          tag: 'script',
          attributes: { type: 'module', nonce: 'a"b&c' },
          urls: { en: '/assets/x.en-1.js?a=1&b=2' },
        },
      ],
    };
    expect(
      createLocaleTwinDocument({ html: builtHtml(data) }).render('en')
    ).toContain(
      '<script type="module" nonce="a&quot;b&amp;c" src="/assets/x.en-1.js?a=1&amp;b=2"></script>'
    );
  });

  it('responds with the request locale and document headers', async () => {
    const document = createLocaleTwinDocument({ html: builtHtml() });
    const response = document.respond(
      request({
        cookie: `${defaultLocaleCookieName}=es`,
        'accept-language': 'fr',
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8'
    );
    expect(response.headers.get('vary')).toBe('Cookie, Accept-Language');
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    const body = await response.text();
    expect(body).toContain('<html lang="es">');
    expect(body).toContain('index-A.es-33333333.js');
  });

  it('keeps headers the caller passed and merges Vary', () => {
    const document = createLocaleTwinDocument({ html: builtHtml() });
    const response = document.respond(request({}), {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'Content-Type': 'text/html',
        Vary: 'Origin, cookie',
        'X-App': 'kept',
      },
    });

    expect(response.headers.get('cache-control')).toBe('private, max-age=60');
    expect(response.headers.get('content-type')).toBe('text/html');
    expect(response.headers.get('vary')).toBe(
      'Origin, cookie, Accept-Language'
    );
    expect(response.headers.get('x-app')).toBe('kept');
  });

  it("uses the build's cookie name unless one is passed", () => {
    const html = builtHtml({ ...DATA, localeCookieName: 'build-locale' });
    expect(
      createLocaleTwinDocument({ html }).resolveLocale({
        cookie: 'build-locale=fr',
      })
    ).toBe('fr');
    expect(
      createLocaleTwinDocument({
        html,
        localeCookieName: 'server-locale',
      }).resolveLocale({ cookie: 'build-locale=fr; server-locale=ja' })
    ).toBe('ja');
  });

  it('throws a diagnostic for a document without locale twin data', () => {
    expect(() =>
      createLocaleTwinDocument({ html: '<!doctype html><html></html>' })
    ).toThrow(/gt-i18n.*Error: The document has no locale twin data/s);
  });

  it('throws a diagnostic for an unknown document data version', () => {
    const html = builtHtml({ ...DATA, version: 2 as 1 });
    expect(() => createLocaleTwinDocument({ html })).toThrow(
      /unsupported locale twin document version 2/i
    );
  });
});

describe('locale twin headers', () => {
  it('keeps documents out of shared caches and varies them by locale inputs', () => {
    expect(getLocaleTwinDocumentHeaders()).toEqual({
      'Content-Type': 'text/html; charset=utf-8',
      Vary: 'Cookie, Accept-Language',
      'Cache-Control': 'private, no-cache',
    });
  });

  it('caches twins and shared files forever', () => {
    expect(getLocaleTwinAssetHeaders()).toEqual({
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });

  it('returns fresh objects', () => {
    getLocaleTwinDocumentHeaders().Vary = 'nope';
    expect(getLocaleTwinDocumentHeaders().Vary).toBe('Cookie, Accept-Language');
  });
});
