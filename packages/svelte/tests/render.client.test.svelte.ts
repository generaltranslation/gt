import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  JsxChild,
  JsxElement,
  Variable,
} from '@generaltranslation/format/types';
import type { Translation } from 'gt-i18n/types';
import Greeting from './fixtures/Greeting.svelte';
import Harness from './fixtures/Harness.svelte';
import LocaleSwitcher from './fixtures/LocaleSwitcher.svelte';
import { hashesOf, setupGT } from './helpers';

const [greetingHash] = hashesOf('Greeting.svelte');

const bold = (children: JsxChild[]): JsxElement => ({
  t: 'b',
  i: 1,
  d: { ti: 'Gras' },
  c: children,
});
const name: Variable = { i: 2, k: '_gt_value_2', v: 'v' };

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

describe('<T> in the browser', () => {
  it('moves existing DOM nodes when a translation reorders content', () => {
    setupGT();
    const props = $state<Record<string, unknown>>({
      component: Greeting,
      props: { name: 'Ada' },
      locale: 'fr',
      translations: {
        [greetingHash]: ['Bonjour ', bold(['cher ', name]), ' !'],
      } satisfies Record<string, Translation>,
    });
    const target = mountHarness(props);
    expect(target.textContent).toBe('Bonjour cher Ada !');
    const element = target.querySelector('b');

    props.translations = {
      [greetingHash]: [bold([name, ' chère']), ', bonjour !'],
    };
    flushSync();

    expect(target.textContent).toBe('Ada chère, bonjour !');
    expect(target.querySelector('b')).toBe(element);
    expect(element?.getAttribute('title')).toBe('Gras');
  });

  it('keeps the current render until the next locale has loaded', async () => {
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => (release = resolve));
    setupGT({}, async (locale) => {
      if (locale !== 'fr') return {};
      await loaded;
      return { [greetingHash]: ['Salut ', bold([name])] };
    });

    const target = mountHarness({ component: LocaleSwitcher, locale: 'en' });
    expect(target.textContent).toContain('Hello dear Ada!');

    target.querySelector('button')!.click();
    flushSync();
    expect(target.textContent).toContain('Hello dear Ada!');

    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(target.textContent).toContain('Salut Ada');
  });
});
