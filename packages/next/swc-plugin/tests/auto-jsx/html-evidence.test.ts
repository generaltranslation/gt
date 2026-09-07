import { expect, it } from 'vitest';
import { readHtmlEvidence } from './html-evidence.mjs';

it('reads rendered content without counting serialized React data as page evidence', () => {
  const html = `<html><head><title>Not body content</title></head><body>
    <h1 data-_gt-hash="real">Hello <!--React boundary--><b>World &amp; friends</b></h1>
    <ScRiPt>self.__next_f.push(['<p data-_gt-hash="fake">Missing page content</p>'])</ScRiPt>
    <STYLE>.label::after { content: 'Stylesheet content'; }</STYLE>
    <template><p data-_gt-hash="template">Inactive template content</p></template>
  </body></html>`;
  const evidence = readHtmlEvidence(html);
  expect(evidence.text.trim()).toBe('Hello World & friends');
  expect(evidence.hashes).toEqual(['real']);
});

it('preserves literal angle brackets and decoded attribute values', () => {
  const evidence = readHtmlEvidence(
    '<p data-_gt-hash="a&amp;b">Use &lt;Card&gt; with &quot;children&quot;</p>'
  );
  expect(evidence.text).toBe('Use <Card> with "children"');
  expect(evidence.hashes).toEqual(['a&b']);
});
