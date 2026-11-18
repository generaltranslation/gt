import { formatNum } from 'generaltranslation';
import { createGT, gtContext } from 'gt-svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Greeting from './fixtures/Greeting.svelte';
import { frenchCatalog } from './frenchCatalog';

function renderGreeting(locale: string): string {
  const gt = createGT({
    defaultLocale: 'en',
    locales: ['fr'],
    locale,
    translations: { fr: frenchCatalog() },
  });
  const { body } = render(Greeting, {
    props: { name: 'Ada', count: 1234 },
    context: gtContext(gt),
  });
  return body.replace(/<!--[^]*?-->/g, '');
}

describe('server rendering', () => {
  it('renders source content in the default locale', () => {
    const html = renderGreeting('en');
    expect(html).toContain('Hello <strong>wonderful <em>world</em></strong>.');
  });

  it('renders translated text and structure into the page', () => {
    const html = renderGreeting('fr');
    expect(html).toContain(
      `Bonjour <strong><em>monde</em> merveilleux</strong> !`
    );
    expect(html).toContain(
      `Ada, vous avez ${formatNum(1234, { locales: ['fr', 'en'] })} messages.`
    );
  });
});
