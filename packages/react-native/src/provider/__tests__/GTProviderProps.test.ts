import { expect, it } from 'vitest';
import type { GTProviderProps } from '../GTProvider';

it('accepts a provider without explicit condition props', () => {
  const props = { children: null } satisfies GTProviderProps;
  expect(props.children).toBeNull();
});
