import { describe, expect, it, vi } from 'vitest';
import { T } from '../T';

const { mockGetLocale, mockServerT } = vi.hoisted(() => ({
  mockGetLocale: vi.fn(),
  mockServerT: vi.fn(),
}));

vi.mock('../../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('gt-react/context', () => ({
  ServerT: mockServerT,
}));

describe('Next server <T>', () => {
  it('passes the request locale to the react-core server implementation', async () => {
    mockGetLocale.mockResolvedValue('fr');

    const result = await T({ children: 'Hello', id: 'greeting' });

    expect(mockGetLocale).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      type: mockServerT,
      props: {
        children: 'Hello',
        id: 'greeting',
        locale: 'fr',
      },
    });
  });
});
