import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import { createGT, gtContext, initializeGT } from 'gt-svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Greeting from './fixtures/Greeting.svelte';
import { frenchCatalog } from './frenchCatalog';

afterEach(() => {
  document.body.innerHTML = '';
  document.cookie = `${defaultLocaleCookieName}=; max-age=0; path=/`;
});

function text(target: HTMLElement): string {
  return target.textContent!.replace(/\s+/g, ' ').trim();
}

function markup(element: Element): string {
  return element.innerHTML.replace(/<!--[^]*?-->/g, '');
}

describe('browser rendering', () => {
  it('switches locale after loading one catalog and keeps handlers inside <T>', async () => {
    const requested: string[] = [];
    const gt = createGT({
      defaultLocale: 'en',
      locales: ['fr'],
      loadTranslations: (locale) => {
        requested.push(locale);
        return frenchCatalog();
      },
    });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Greeting, {
      target,
      props: { name: 'Ada', count: 3 },
      context: gtContext(gt),
    });
    expect(text(target)).toContain('Welcome Hello wonderful world.');

    await gt.setLocale('fr');
    flushSync();
    expect(target.querySelector('h1')!.title).toBe('Titre');
    expect(markup(target.querySelector('strong')!)).toBe(
      '<em>monde</em> merveilleux'
    );
    expect(text(target)).toContain('Ada, vous avez 3 messages.');
    expect(requested).toEqual(['fr']);
    expect(document.cookie).toContain(`${defaultLocaleCookieName}=fr`);

    target.querySelector('button')!.click();
    flushSync();
    expect(target.querySelector('button')!.textContent).toBe('ici');
    expect(target.querySelector('output')!.textContent).toBe('1');
    unmount(app);
  });

  it('translates module-level gt() calls after initializeGT()', async () => {
    await initializeGT({
      defaultLocale: 'en',
      locales: ['fr'],
      locale: 'fr',
      loadTranslations: () => frenchCatalog(),
    });
    const { navigation } = await import('./fixtures/messages');
    expect(navigation).toEqual(['Documentation (fr)']);
  });
});
