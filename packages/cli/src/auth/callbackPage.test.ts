import { describe, expect, it } from 'vitest';
import { renderCallbackPage } from './callbackPage.js';

describe('callback page', () => {
  it('tells the user to run login again only when authentication failed', () => {
    const failure = renderCallbackPage(false);
    expect(failure).toContain('<h1>Authentication failed</h1>');
    expect(failure).toContain('class="error"');
    expect(failure).toContain('npx gt login');

    const success = renderCallbackPage(true);
    expect(success).toContain('<h1>Successfully authenticated gt CLI</h1>');
    expect(success).toContain(
      'You may now close this tab and return to the terminal.'
    );
    expect(success).not.toContain('npx gt login');
    expect(success).not.toContain('class="error"');
  });

  it('serves no external assets and keeps the theme swap inline', () => {
    const page = renderCallbackPage(true);
    expect(page).not.toMatch(/(src|href)=["']https?:/);
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain('<svg');
  });
});
