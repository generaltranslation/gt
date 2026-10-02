import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { CALLBACK_PAGE_CSP, renderCallbackPage } from '../callbackPage.js';

/** WCAG 2 relative luminance of a six-digit hex color. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a
  );
  return (light! + 0.05) / (dark! + 0.05);
}

/** The custom property's value in the page's light block, or its dark block. */
function token(page: string, name: string, scheme: 'light' | 'dark'): string {
  const dark = page.indexOf('prefers-color-scheme: dark');
  const block = scheme === 'light' ? page.slice(0, dark) : page.slice(dark);
  const match = block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`));
  if (!match) throw new Error(`No --${name} in the ${scheme} block`);
  return match[1]!;
}

describe('callback page', () => {
  it('keeps the note readable in both schemes and declares no token the styles never read', () => {
    const page = renderCallbackPage({ ok: true, account: 'dev@example.com' });
    // The note is 13px text, so WCAG AA asks 4.5:1 against the paper.
    for (const scheme of ['light', 'dark'] as const) {
      expect(
        contrast(token(page, 'titanium', scheme), token(page, 'paper', scheme))
      ).toBeGreaterThanOrEqual(4.5);
    }
    const declared = [...page.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]);
    for (const name of new Set(declared)) {
      expect(page).toContain(`var(--${name})`);
    }
  });

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

  it('sets the retry command between monospace spaces and copies it with the one script the policy allows', () => {
    for (const reason of ['denied', 'failed'] as const) {
      const page = renderCallbackPage({ ok: false, reason });
      expect(page).toContain(
        'Run<span class="gap"> </span><button type="button" class="cmd" aria-label="Copy npx gt login">npx gt login</button><span class="gap"> </span>to try again.<span class="copied" role="status"></span>'
      );
      const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
      expect(scripts).toHaveLength(1);
      const hash = createHash('sha256')
        .update(scripts[0]![1]!)
        .digest('base64');
      expect(CALLBACK_PAGE_CSP).toBe(
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${hash}'`
      );
      expect(scripts[0]![1]).toContain('navigator.clipboard.writeText');
    }
    expect(
      renderCallbackPage({ ok: true, account: 'dev@example.com' })
    ).not.toContain('<script');
  });

  it('is the plate alone on the plain ground: no field, no footer, no external assets, the theme swap inline', () => {
    const page = renderCallbackPage({ ok: true });
    expect(page).not.toMatch(/(src|href)=["']https?:/);
    expect(page).not.toMatch(/url\(/);
    expect(page).not.toContain('data:image');
    expect(page).not.toContain('<footer');
    expect(page).not.toContain('class="field"');
    expect(page).toContain('justify-content: center');
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain('<svg');
    expect(page).not.toContain('<script');
  });
});
