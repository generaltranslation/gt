import { describe, expect, it } from 'vitest';
import { serializeCookieValue } from '../cookies';

describe('serializeCookieValue', () => {
  it('serializes the NEXT_LOCALE production cookie policy', () => {
    expect(
      serializeCookieValue({
        cookieName: 'NEXT_LOCALE',
        value: 'fr',
        options: {
          maxAge: 31_536_000,
          path: '/',
          sameSite: 'lax',
          secure: true,
        },
      })
    ).toBe('NEXT_LOCALE=fr;Path=/;Max-Age=31536000;SameSite=Lax;Secure');
  });

  it('omits Secure for HTTP development environments', () => {
    expect(
      serializeCookieValue({
        cookieName: 'NEXT_LOCALE',
        value: 'en',
        options: {
          maxAge: 31_536_000,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
      })
    ).toBe('NEXT_LOCALE=en;Path=/;Max-Age=31536000;SameSite=Lax');
  });
});
