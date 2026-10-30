import { describe, expect, it } from 'vitest';
import type { LocaleTwinManifest } from 'generaltranslation/internal';
import { parseLocaleTwinDocument } from 'gt-i18n/internal/locale-twins';
import { rewriteLocaleTwinDocument } from '../spaDocument';

const manifest: LocaleTwinManifest = {
  version: 1,
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  twinned: ['assets/index-A.js', 'assets/page-B.js'],
  entries: ['assets/index-A.js'],
  versions: { en: '11111111', fr: '22222222' },
  twins: {
    en: {
      'assets/index-A.js': 'assets/index-A.en-11111111.js',
      'assets/page-B.js': 'assets/page-B.en-11111111.js',
    },
    fr: {
      'assets/index-A.js': 'assets/index-A.fr-22222222.js',
      'assets/page-B.js': 'assets/page-B.fr-22222222.js',
    },
  },
};

function document(entryScript: string, extra = ''): string {
  return `<!doctype html>
<html lang="en">
  <head>
    ${entryScript}
    <link rel="modulepreload" crossorigin href="/assets/page-B.js">
    ${extra}
  </head>
  <body><div id="root"></div></body>
</html>
`;
}

function rewrite(html: string) {
  return rewriteLocaleTwinDocument({
    html,
    manifest,
    localeCookieName: 'generaltranslation.locale',
  });
}

describe('rewriteLocaleTwinDocument', () => {
  it.each([
    '</script>',
    '</script >',
    '</SCRIPT\t>',
    '</script\n>',
    '</script foo="bar">',
  ])('replaces an entry script whose end tag reads %j', (endTag) => {
    const result = rewrite(
      document(
        `<script type="module" crossorigin src="/assets/index-A.js">${endTag}`
      )
    );

    expect(result?.html).toContain('id="gt-locale-twins-data"');
    expect(result?.html).not.toContain('src="/assets/index-A.js"');
    expect(result?.html).not.toContain('href="/assets/page-B.js"');
  });

  it.each([
    '<!-- <script type="module" src="/assets/index-A.js"></script> -->',
    '<!-- <script type="module" src="/assets/index-A.js"></script> --!>',
  ])('leaves an entry script inside a comment alone: %j', (comment) => {
    const html = document(
      '<script type="module" crossorigin src="/assets/index-A.js"></script>',
      comment
    );

    const result = rewrite(html);

    expect(result?.html).toContain(comment);
  });

  it('leaves the rest of an unclosed comment alone', () => {
    const html = `<!doctype html>
<html><head>
<!-- <script type="module" src="/assets/index-A.js"></script>
</head></html>
`;

    expect(rewrite(html)).toBeUndefined();
  });

  it('writes the enable-i18n cookie and the custom locale codes for the bootstrap', () => {
    const result = rewriteLocaleTwinDocument({
      html: document(
        '<script type="module" crossorigin src="/assets/index-A.js"></script>'
      ),
      manifest,
      localeCookieName: 'generaltranslation.locale',
      enableI18nCookieName: 'generaltranslation.enable-i18n',
      customMapping: {
        fr: { code: 'fr-FR', name: 'Français' },
        en: 'English',
      },
    })!;

    const { data } = parseLocaleTwinDocument(result.html);
    expect(data.enableI18nCookieName).toBe('generaltranslation.enable-i18n');
    expect(data.customMapping).toEqual({ fr: { code: 'fr-FR' } });
  });

  it.each([
    [
      undefined,
      /<script data-gt-locale-twins-bootstrap nonce="n0nce">\(function/,
    ],
    [
      { fileName: 'gt-locale-twins-bootstrap.abc.js' },
      /<script data-gt-locale-twins-bootstrap nonce="n0nce" src="\/assets\/gt-locale-twins-bootstrap\.abc\.js"><\/script>/,
    ],
  ])(
    "gives the bootstrap the entry script's CSP nonce (external: %j)",
    (externalBootstrap, bootstrapTag) => {
      const result = rewriteLocaleTwinDocument({
        html: document(
          '<script type="module" crossorigin nonce="n0nce" src="/assets/index-A.js"></script>'
        ),
        manifest,
        localeCookieName: 'generaltranslation.locale',
        externalBootstrap,
      })!;

      expect(result.html).toMatch(bootstrapTag);
      expect(parseLocaleTwinDocument(result.html).data.tags[0]).toMatchObject({
        tag: 'script',
        attributes: { nonce: 'n0nce' },
      });
    }
  );
});
