import { expect, test as base } from '@playwright/test';

export { expect };

export const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];

      page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.message}`);
      });
      page.on('console', (message) => {
        if (message.type() !== 'error' || isIgnoredFaviconError(message)) {
          return;
        }
        errors.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) => {
        if (request.failure()?.errorText === 'net::ERR_ABORTED') {
          return;
        }
        errors.push(
          `requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`
        );
      });

      await use();

      if (errors.length > 0) {
        await testInfo.attach('browser-errors', {
          body: Buffer.from(errors.join('\n')),
          contentType: 'text/plain',
        });
      }
      expect(errors, 'browser console, page, and network errors').toEqual([]);
    },
    { auto: true },
  ],
});

function isIgnoredFaviconError(message: {
  location(): { url?: string };
  text(): string;
}) {
  return (
    message.location().url?.endsWith('/favicon.ico') === true &&
    message.text().includes('Failed to load resource')
  );
}
