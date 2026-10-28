import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Harness from './fixtures/Harness.svelte';
import LocaleInfo from './fixtures/LocaleInfo.svelte';
import { setupGT } from './helpers';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
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

const text = (target: HTMLElement, className: string) =>
  target.querySelector(`.${className}`)?.textContent;

const click = (target: HTMLElement, locale: string) =>
  target.querySelector<HTMLButtonElement>(`[data-locale="${locale}"]`)!.click();

describe('locale helpers in the browser', () => {
  it('render the configured default locale and locales', () => {
    setupGT();
    const target = mountHarness({ component: LocaleInfo, locale: 'en' });
    expect(text(target, 'default')).toBe('en');
    expect(text(target, 'locales')).toBe('en,fr,de,ar,he,fa');
  });

  it('follow setLocale with the active locale properties', async () => {
    setupGT();
    const target = mountHarness({ component: LocaleInfo, locale: 'en' });
    expect(text(target, 'active')).toBe('en|English');

    click(target, 'de');
    await settle();
    expect(text(target, 'active')).toBe('de|Deutsch');
    expect(text(target, 'fixed')).toBe('fr|français');

    click(target, 'he');
    await settle();
    expect(text(target, 'active')).toBe('he|עברית');
  });

  it('follow a <GTProvider locale> change', () => {
    setupGT();
    const props = $state<Record<string, unknown>>({
      component: LocaleInfo,
      locale: 'fr',
      translations: {},
    });
    const target = mountHarness(props);
    expect(text(target, 'active')).toBe('fr|français');

    props.locale = 'fa';
    flushSync();
    expect(text(target, 'active')).toBe('fa|فارسی');
  });
});
