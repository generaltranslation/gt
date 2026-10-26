import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DirectionPage from './fixtures/DirectionPage.svelte';
import Harness from './fixtures/Harness.svelte';
import { setupGT } from './helpers';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

function mountHarness(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Harness, { target, props: props as never });
  cleanup = () => unmount(component);
  flushSync();
  return target;
}

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  flushSync();
};

const shown = (target: HTMLElement, className: string) => {
  const element = target.querySelector(`.${className}`)!;
  return { dir: element.getAttribute('dir'), text: element.textContent };
};

const html = () => ({
  lang: document.documentElement.getAttribute('lang'),
  dir: document.documentElement.getAttribute('dir'),
});

const click = (target: HTMLElement, locale: string) =>
  target.querySelector<HTMLButtonElement>(`[data-locale="${locale}"]`)!.click();

describe('useLocaleDirection in the browser', () => {
  it('follows setLocale between ltr and rtl locales', async () => {
    setupGT();
    const target = mountHarness({ component: DirectionPage, locale: 'en' });
    expect(shown(target, 'active')).toEqual({ dir: 'ltr', text: 'ltr' });

    for (const [locale, dir] of [
      ['ar', 'rtl'],
      ['fr', 'ltr'],
      ['he', 'rtl'],
      ['fa', 'rtl'],
      ['en', 'ltr'],
    ]) {
      click(target, locale);
      await settle();
      expect(shown(target, 'active')).toEqual({ dir, text: dir });
    }
  });

  it('follows a <GTProvider locale> change', () => {
    setupGT();
    const props = $state<Record<string, unknown>>({
      component: DirectionPage,
      locale: 'fr',
      translations: {},
    });
    const target = mountHarness(props);
    expect(shown(target, 'active')).toEqual({ dir: 'ltr', text: 'ltr' });

    props.locale = 'ar';
    flushSync();
    expect(shown(target, 'active')).toEqual({ dir: 'rtl', text: 'rtl' });
  });

  it('keeps the direction of an explicit locale', async () => {
    setupGT();
    const target = mountHarness({ component: DirectionPage, locale: 'en' });
    expect(shown(target, 'fixed')).toEqual({ dir: 'rtl', text: 'rtl' });
    click(target, 'fr');
    await settle();
    expect(shown(target, 'fixed')).toEqual({ dir: 'rtl', text: 'rtl' });
  });

  it('keeps <html lang dir> in sync with the documented component', async () => {
    setupGT();
    const target = mountHarness({ component: DirectionPage, locale: 'en' });
    expect(html()).toEqual({ lang: 'en', dir: 'ltr' });

    click(target, 'ar');
    await settle();
    expect(html()).toEqual({ lang: 'ar', dir: 'rtl' });

    click(target, 'fr');
    await settle();
    expect(html()).toEqual({ lang: 'fr', dir: 'ltr' });
  });
});
