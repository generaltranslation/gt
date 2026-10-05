import { describe, expect, it } from 'vitest';
import { isJson, refuseRequest, UI_DEV_PORT } from '../server/guard.ts';

const request = (overrides: Partial<Parameters<typeof refuseRequest>[0]>) => ({
  method: 'GET',
  path: '/api/examples',
  host: 'localhost:4600',
  origin: undefined,
  contentType: undefined,
  ...overrides,
});

describe('refuseRequest', () => {
  it('allows reads and writes from the app itself and from curl or agents', () => {
    expect(refuseRequest(request({}), 4600)).toBeNull();
    expect(refuseRequest(request({ host: '127.0.0.1:4600' }), 4600)).toBeNull();
    expect(refuseRequest(request({ method: 'POST' }), 4600)).toBeNull();
    expect(
      refuseRequest(
        request({ method: 'POST', origin: 'http://localhost:4600' }),
        4600
      )
    ).toBeNull();
    expect(
      refuseRequest(
        request({ method: 'POST', origin: `http://localhost:${UI_DEV_PORT}` }),
        4600
      )
    ).toBeNull();
  });

  it('refuses other sites that try to start builds', () => {
    expect(
      refuseRequest(
        request({ method: 'POST', origin: 'https://example.com' }),
        4600
      )
    ).toMatch(/Cross-origin/);
    expect(
      refuseRequest(
        request({ method: 'POST', origin: 'http://localhost:3000' }),
        4600
      )
    ).toMatch(/Cross-origin/);
  });

  it('refuses DNS-rebinding hosts and wrong ports', () => {
    expect(refuseRequest(request({ host: 'evil.example:4600' }), 4600)).toMatch(
      /localhost/
    );
    expect(refuseRequest(request({ host: 'localhost:4601' }), 4600)).toMatch(
      /localhost/
    );
    expect(refuseRequest(request({ host: undefined }), 4600)).toMatch(
      /localhost/
    );
  });
});

describe('isJson', () => {
  it('accepts JSON only', () => {
    expect(isJson('application/json')).toBe(true);
    expect(isJson('application/json; charset=utf-8')).toBe(true);
    expect(isJson('text/plain')).toBe(false);
    expect(isJson(undefined)).toBe(false);
  });
});

describe('build-starting GET requests', () => {
  it('refuses API reads that a browser marks as cross-site or same-site', () => {
    for (const fetchSite of ['cross-site', 'same-site']) {
      expect(
        refuseRequest(
          request({ path: '/api/examples/next-app/events', fetchSite }),
          4600
        )
      ).toMatch(/Other sites/);
    }
  });

  it('allows the app itself, direct visits, and clients without the header', () => {
    for (const fetchSite of ['same-origin', 'none', undefined]) {
      expect(
        refuseRequest(
          request({ path: '/api/examples/next-app?fresh=1', fetchSite }),
          4600
        )
      ).toBeNull();
    }
  });

  it('still serves the page itself to links from other sites', () => {
    expect(
      refuseRequest(
        request({ path: '/next-app', fetchSite: 'cross-site' }),
        4600
      )
    ).toBeNull();
  });
});
