import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCookieValue, setCookieValue } from '../cookies';

let jar: Record<string, string>;
let reads: number;

beforeEach(async () => {
  // Ends the task of the previous test.
  await Promise.resolve();
  jar = {};
  reads = 0;
  vi.stubGlobal('document', {
    get cookie() {
      reads++;
      return Object.entries(jar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    },
    set cookie(cookie: string) {
      const [name, value] = cookie.split(';')[0].split('=');
      jar[name] = value;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCookieValue', () => {
  it('reads a cookie once per task', async () => {
    jar.locale = 'fr';

    expect(getCookieValue({ cookieName: 'locale' })).toBe('fr');
    expect(getCookieValue({ cookieName: 'locale' })).toBe('fr');
    expect(reads).toBe(1);

    // Another tab or a server response changes the cookie between tasks.
    jar.locale = 'es';
    await Promise.resolve();
    expect(getCookieValue({ cookieName: 'locale' })).toBe('es');
    expect(reads).toBe(2);
  });

  it('reads a cookie it wrote in the same task', () => {
    jar.locale = 'fr';
    expect(getCookieValue({ cookieName: 'locale' })).toBe('fr');

    setCookieValue({ cookieName: 'locale', value: 'es' });

    expect(getCookieValue({ cookieName: 'locale' })).toBe('es');
  });
});
