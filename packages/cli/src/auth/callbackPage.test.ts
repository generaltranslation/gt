import { describe, expect, it } from 'vitest';
import { renderCallbackPage } from './callbackPage.js';

describe('callback page', () => {
  it('names the account on success and never asks to log in again', () => {
    const page = renderCallbackPage({ ok: true, account: 'dev@example.com' });
    expect(page).toContain('Signed in to the gt CLI');
    expect(page).toContain(
      'You can close this tab and return to your terminal.'
    );
    expect(page).toContain(
      'Signed in as <span class="ink">dev@example.com</span>.'
    );
    expect(page).toContain('class="glyph success"');
    expect(page).not.toContain('class="glyph error"');
    expect(page).not.toContain('npx gt login');
  });

  it('leaves the note off when the account is unknown and escapes it', () => {
    expect(renderCallbackPage({ ok: true })).not.toContain('class="note"');
    const page = renderCallbackPage({
      ok: true,
      account: '<b>x</b>@example.com',
    });
    expect(page).toContain('&lt;b&gt;x&lt;/b&gt;@example.com');
    expect(page).not.toContain('<b>x</b>');
  });

  it('tells a denied request from a failed exchange, both with the retry command', () => {
    const denied = renderCallbackPage({ ok: false, reason: 'denied' });
    expect(denied).toContain('Request denied');
    expect(denied).toContain('You did not authorize the CLI');
    expect(denied).toContain('class="glyph error"');
    expect(denied).toContain('npx gt login');

    const failed = renderCallbackPage({ ok: false, reason: 'failed' });
    expect(failed).toContain('Sign-in failed');
    expect(failed).toContain('Your terminal shows the reason.');
    expect(failed).toContain('class="glyph error"');
    expect(failed).toContain('npx gt login');
    expect(failed).not.toContain('Signed in to the gt CLI');
  });

  it('serves no external assets: the field is a data URI and the theme swap is inline', () => {
    const page = renderCallbackPage({ ok: true });
    expect(page).not.toMatch(/(src|href)=["']https?:/);
    expect(page).not.toMatch(/url\(["']?https?:/);
    expect(page).toContain('url("data:image/png;base64,');
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain('<svg');
    expect(page).not.toContain('<script');
  });
});
