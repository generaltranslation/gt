import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Content } from '@generaltranslation/format/types';
import BareBranch from './fixtures/BareBranch.svelte';
import Harness from './fixtures/Harness.svelte';
import NestedBranches from './fixtures/NestedBranches.svelte';
import StatusBranch from './fixtures/StatusBranch.svelte';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [statusHash] = hashesOf('StatusBranch.svelte');
const [nestedHash] = hashesOf('NestedBranches.svelte');

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

const statusTranslation = {
  t: 'Branch',
  i: 1,
  d: {
    t: 'b',
    b: {
      away: 'Absent',
      online: { t: 'C2', i: 2, c: { t: 'i', i: 3, c: 'En ligne' } },
    },
  },
  c: 'Inconnu',
} satisfies Content;

const renderFr = (status: unknown, translation: Content = statusTranslation) =>
  html({
    component: StatusBranch,
    props: { status },
    locale: 'fr',
    translations: { [statusHash]: translation },
  });

// Branch values often come from user input, such as a query parameter.
const prototypeMembers = [
  '__proto__',
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__defineGetter__',
];

describe('<Branch> values that name Object.prototype members', () => {
  beforeEach(() => setupGT());

  it('renders matching branches in both locales', () => {
    for (const component of [BareBranch, StatusBranch]) {
      expect(html({ component, props: { status: 'away' } })).toBe('Away');
      expect(html({ component, props: { status: 'online' } })).toBe(
        '<i>Online</i>'
      );
    }
    expect(renderFr('away')).toBe('Absent');
    expect(renderFr('online')).toBe('<i>En ligne</i>');
  });

  it.each(prototypeMembers)(
    'renders the translated fallback for branch=%s',
    (status) => {
      expect(renderFr(status)).toBe('Inconnu');
    }
  );
});

describe('malformed branch translations', () => {
  beforeEach(() => setupGT());

  it.each([
    ['a string', 'abc'],
    ['a number', 5],
    ['a boolean', true],
    ['an array', ['Absent']],
  ])('falls back to the source when d.b is %s', (_label, b) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      renderFr('online', {
        t: 'Branch',
        i: 1,
        d: { t: 'b', b },
        c: 'x',
      } as unknown as Content)
    ).toBe('<i>Online</i>');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('nested branches in sibling snippets', () => {
  beforeEach(() => setupGT());

  // Both nested <Plural>s have id 3, in different branch scopes. Each
  // translated branch must be checked against the source branch it renders
  // with, or the `female` plural's fragments are looked up under `male`.
  it('renders a translation whose nested plural uses snippets', () => {
    const translation = {
      t: 'Branch',
      i: 1,
      d: {
        t: 'b',
        b: {
          male: {
            t: 'C2',
            i: 2,
            c: [
              'Il a ',
              {
                t: 'Plural',
                i: 3,
                d: { t: 'p', b: { one: 'un chat', other: 'des chats' } },
              },
            ],
          },
          female: {
            t: 'C2',
            i: 2,
            c: [
              'Elle a ',
              {
                t: 'Plural',
                i: 3,
                d: {
                  t: 'p',
                  b: {
                    one: { t: 'C4', i: 4, c: 'un chat' },
                    other: { t: 'C4', i: 4, c: 'des chats' },
                  },
                },
              },
            ],
          },
        },
      },
    } satisfies Content;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderNested = (props: Record<string, unknown>) =>
      html({
        component: NestedBranches,
        props,
        locale: 'fr',
        translations: { [nestedHash]: translation },
      });
    expect(renderNested({ gender: 'female', count: 2 })).toBe(
      'Elle a des chats'
    );
    expect(renderNested({ gender: 'female', count: 1 })).toBe('Elle a un chat');
    expect(renderNested({ gender: 'male', count: 1 })).toBe('Il a un chat');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
