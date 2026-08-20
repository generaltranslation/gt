// Web fonts break in cross-origin replay. rrweb keeps `@font-face` rules but leaves
// their `src: url(...)` pointing at the app's origin; fonts are ALWAYS CORS-checked,
// so a replay served from any other origin (or a static file) fails the fetch and
// silently falls back to a system font. (`collectFonts` captures the RULES, not the
// binaries — it does not make the recording portable.)
//
// This runs at capture time, IN the app, so the font files are same-origin and
// fetchable. It re-declares each url()-based @font-face with a base64 `data:` src, to
// be injected as a <style> BEFORE the snapshot so the fonts travel inside the bundle.
// Declared last, these faces win over the originals (identical descriptors, working
// src), so the replay renders the real fonts anywhere.

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

// Skip pathologically large files — a demo recording shouldn't embed a 10MB font.
const MAX_FONT_BYTES = 5 * 1024 * 1024;

function mimeFor(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  return FONT_MIME[ext] ?? 'application/octet-stream';
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...(bytes.subarray(i, i + chunk) as unknown as number[])
    );
  }
  return btoa(binary);
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_FONT_BYTES) return null;
    return `data:${mimeFor(url)};base64,${bufToBase64(buf)}`;
  } catch {
    return null;
  }
}

// Replace every non-data url() in an @font-face's cssText with a data: URI. Uses
// split/join so identical url()s (multiple faces sharing a file) all resolve.
async function inlineUrls(
  cssText: string,
  base: string
): Promise<{ css: string; inlined: number }> {
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const targets = new Map<string, string>(); // matched url(...) -> absolute url
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText))) {
    if (/^data:/i.test(m[2])) continue;
    let abs = m[2];
    try {
      abs = new URL(m[2], base).href;
    } catch {
      /* leave as-is */
    }
    targets.set(m[0], abs);
  }
  let css = cssText;
  let inlined = 0;
  for (const [full, abs] of targets) {
    const data = await toDataUri(abs);
    if (data) {
      css = css.split(full).join(`url(${data})`);
      inlined++;
    }
  }
  return { css, inlined };
}

/**
 * For each url()-based `@font-face` in the page's same-origin stylesheets: (1) download
 * the font file, (2) base64-serialize it into a `data:` URI, (3) rewrite the rule's
 * src to that URI. Returns a single stylesheet string of these self-contained
 * @font-face rules (empty if none). The recorder injects that string into <head>
 * before the snapshot (see injectFontStyle) so the recording carries its own fonts.
 * Cross-origin sheets (unreadable `.cssRules`) are skipped. Never throws.
 */
export async function collectInlinedFontFaceCss(): Promise<string> {
  if (typeof document === 'undefined') return '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet: CSSOM not readable
    }
    const base = sheet.href ?? document.baseURI;
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof window.CSSFontFaceRule)) continue;
      const text = rule.cssText;
      if (!/url\(/i.test(text)) continue; // local()-only face: nothing to fetch
      if (seen.has(text)) continue;
      seen.add(text);
      const { css, inlined } = await inlineUrls(text, base);
      if (inlined > 0) out.push(css);
    }
  }
  return out.join('\n');
}

// ----- <head> injection (recorder lifecycle) ----- //

const FONT_STYLE_ID = 'gt-rrweb-fonts';

// Fetch the inlined-font stylesheet — the ASYNC part, which does NOT mutate the DOM, so
// the recorder can await it before committing to a recording. Best effort: a
// fetch/CORS failure just leaves the replay on fallback fonts.
export async function fetchInlinedFontCss(): Promise<string> {
  try {
    return await collectInlinedFontFaceCss();
  } catch {
    return '';
  }
}

// Append the inlined fonts to <head> BEFORE the snapshot so the recording carries its
// own fonts. Synchronous DOM mutation — only called once the recorder owns a recording.
export function injectFontStyle(css: string): void {
  if (typeof document === 'undefined') return;
  if (!css || document.getElementById(FONT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export function removeInlinedFonts(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(FONT_STYLE_ID)?.remove();
}
