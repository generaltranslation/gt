import { createHash } from 'node:crypto';

// The page the loopback server shows once `gt login` has finished. It is
// served from 127.0.0.1 under CALLBACK_PAGE_CSP, so everything is inline: the brand deck's tokens (paper and ink with a
// prefers-color-scheme swap, ink-2 for the sentence, titanium for the note,
// the status hues), the GT mark and a Heroicons 24/solid status glyph. The
// composition is the dashboard's auth plate in its centered form: the plate
// alone on the plain ground, centered both ways, with the mark, a 24px
// heading with the glyph, a lede, and a 13px note naming the account. No
// field, no footer, nothing from the network and no webfont; Inter is used
// when it is installed. The one script copies the retry command on click; the
// policy allows it by its hash and allows no other script.
/** What the page says: a signed-in account, or why the login did not finish. */
export type CallbackPageView =
  | { ok: true; account?: string }
  | { ok: false; reason: 'denied' | 'failed' };

/** The part of a success view the login flow can add after the exchange. */
export type CallbackPageDetails = { account?: string };

const STYLES = `
  :root {
    color-scheme: light dark;
    --ink: #070707;
    --ink-2: #3a3d44;
    --titanium: #6e737c;
    --paper: #ffffff;
    --success: #12a37a;
    --danger: #e5484d;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #f2f2f0;
      --ink-2: #b9bcc3;
      --titanium: #8a8f98;
      --paper: #070707;
    }
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { min-height: 100%; }
  body {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    background: var(--paper);
    color: var(--ink);
    font: 15px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
  }
  .plate {
    width: 100%;
    max-width: 520px;
    padding: 28px 20px;
    background: var(--paper);
  }
  @media (min-width: 640px) {
    .plate { padding: 40px; }
  }
  svg { display: block; }
  .mark { width: 25px; height: 25px; margin-bottom: 32px; }
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    line-height: 1.1;
    font-weight: 500;
    letter-spacing: -0.0195em;
    text-wrap: balance;
  }
  .glyph { width: 24px; height: 24px; flex: none; }
  .success { color: var(--success); }
  .error { color: var(--danger); }
  .lede { margin-top: 12px; color: var(--ink-2); }
  .note {
    margin-top: 32px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--titanium);
    overflow-wrap: anywhere;
  }
  .note .ink { color: var(--ink); }
  .gap {
    font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  /* A button reset to inline text. */
  .cmd {
    all: unset;
    font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--ink);
    cursor: pointer;
  }
  .cmd:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  /* The icon after the command, one monospace space from it. Both glyphs keep
     the same box, so the line does not move when the check replaces the copy
     icon. */
  .cmd svg {
    display: inline-block;
    width: 13px;
    height: 13px;
    margin-left: 1ch;
    vertical-align: -2px;
    color: var(--titanium);
  }
  .cmd .done {
    display: none;
    color: var(--success);
  }
  .cmd.is-copied .copy { display: none; }
  .cmd.is-copied .done { display: inline-block; }
  .status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`;

// Copies the retry command and shows a check for 1.6s, announced to screen
// readers.
const COPY_SCRIPT = `const cmd = document.querySelector('.cmd');
const status = document.querySelector('.status');
let timer;
cmd.addEventListener('click', () => {
  navigator.clipboard.writeText('npx gt login').then(() => {
    cmd.classList.add('is-copied');
    status.textContent = 'Copied';
    clearTimeout(timer);
    timer = setTimeout(() => {
      cmd.classList.remove('is-copied');
      status.textContent = '';
    }, 1600);
  }, () => {});
});`;

/** The policy the loopback server sends with the page. */
export const CALLBACK_PAGE_CSP = `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${createHash('sha256').update(COPY_SCRIPT).digest('base64')}'`;

/** The General Translation globe from the current brand asset set. */
const GT_MARK =
  '<svg class="mark" viewBox="24.3 24.3 207.4 207.4" fill="currentColor" aria-hidden="true"><path d="M128 24.3C185.2718 24.3 231.7 70.7282 231.7 128C231.7 185.2718 185.2718 231.7 128 231.7C70.7282 231.7 24.3 185.2718 24.3 128C24.3 70.7282 70.7282 24.3 128 24.3ZM212.4408 160.6176C208.2429 164.0957 203.4651 167.2246 198.3009 169.9668C181.4019 178.9395 159.0074 184.6262 134.4073 185.5665V185.618C132.6143 185.6759 130.7716 185.7062 128.8517 185.7062C128.503 185.7062 128.1571 185.704 127.8147 185.7032C127.5929 185.704 127.3706 185.7057 127.1483 185.7057C125.7331 185.7057 124.3239 185.6896 122.9215 185.6585C122.12 185.644 121.33 185.627 120.5472 185.6048V185.5908C110.8573 185.2543 101.5043 184.1816 92.6879 182.4615C94.1044 186.043 95.652 189.4074 97.3137 192.5274C104.1447 205.3483 112.3194 213.1102 120.5472 215.9674V191.5696C123.1949 191.6428 125.9111 191.6684 128.8517 191.6684C130.769 191.6684 132.6126 191.6394 134.4073 191.5836V216.1595C139.4513 214.5484 144.4817 211.0835 149.2787 205.6421C153.2755 201.1087 156.9691 195.3424 160.1802 188.5348C164.6255 187.7925 168.3778 187.0383 172.0723 186.0916C173.3708 185.759 174.659 185.403 175.9656 185.0175C172.0131 195.6137 166.9354 204.9271 160.9144 212.3253C184.518 203.1052 203.3015 184.2616 212.4408 160.6176ZM93.3693 44.3647C71.2261 53.5437 53.5173 71.2606 44.3485 93.4085C47.9115 90.7114 51.8277 88.2461 55.9955 86.0332C60.5689 83.6049 65.545 81.4176 70.8581 79.4995C69.5098 84.4779 68.331 89.7179 67.3617 95.1533C65.5706 95.9667 63.8441 96.8138 62.1869 97.6936C45.609 106.496 37.5021 117.5278 37.5021 128C37.5021 138.4722 45.609 149.504 62.1869 158.3064C63.8503 159.1896 65.5838 160.0393 67.3821 160.8552C68.3548 166.3034 69.5204 171.5425 70.8079 176.4818C65.5137 174.5679 60.5544 172.3874 55.9955 169.9668C51.8276 167.7535 47.9116 165.2881 44.3485 162.5911C53.6532 185.0678 71.7529 202.98 94.3569 212.0375C91.1411 208.0466 88.2329 203.56 85.6623 198.7353C75.7799 180.186 69.8684 155.0152 69.8684 127.5741C69.8684 100.133 75.7799 74.9627 85.6623 56.4134C87.9671 52.0876 90.5432 48.0335 93.3693 44.3647ZM83.2331 135.1359C83.7373 146.8785 85.4038 157.9337 87.9824 167.9026C99.4214 170.7465 112.2465 172.4006 125.8711 172.4982C126.3106 172.5011 126.7543 172.5028 127.2019 172.5033C152.8982 172.4956 175.8336 166.9486 192.1096 158.3064C204.8956 151.5175 212.6413 143.4017 215.5164 135.2398H144.8411C139.0787 135.2398 134.4073 139.9112 134.4073 145.6737V166.4026C132.0488 166.4946 129.6813 166.5419 127.3612 166.5419C124.9759 166.5419 122.7192 166.5074 120.5472 166.4384V145.5698C120.5472 139.8073 115.8758 135.1359 110.1133 135.1359ZM127.7466 37.9279C117.2152 37.928 106.1421 46.0504 97.3137 62.621C95.5097 66.0071 93.8408 69.6814 92.3276 73.6088C103.2334 71.4556 114.967 70.2943 127.1483 70.2943C155.5173 70.2943 181.5795 76.5993 200.3656 87.1609L193.5273 98.4649C177.2343 89.4151 153.7236 83.4963 127.1483 83.4963C112.956 83.4963 99.6049 85.1866 87.7512 88.1545C85.2053 98.2792 83.5951 109.4971 83.1786 121.399H218.2603C215.7285 86.273 193.1483 56.7009 161.905 44.0677C167.6573 51.465 172.5084 60.64 176.291 71.011C171.261 69.5545 165.9959 68.3161 160.5086 67.3161C157.2217 60.2019 153.4122 54.1947 149.2787 49.5059C142.3668 41.6658 134.9715 37.9279 127.7466 37.9279Z"/></svg>';

// Lucide copy and check (ISC), the control icons the landing uses.
const COPY_ICON =
  '<svg class="copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const DONE_ICON =
  '<svg class="done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

// Heroicons 24/solid check-circle and x-circle (MIT, Tailwind Labs).
const CHECK_CIRCLE =
  '<svg class="glyph success" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"/></svg>';
const X_CIRCLE =
  '<svg class="glyph error" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"/></svg>';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The spaces around the command are monospace, so the gap before and after
// it matches the gap between its words.
const RETRY = `Run<span class="gap"> </span><button type="button" class="cmd" aria-label="Copy npx gt login">npx gt login${COPY_ICON}${DONE_ICON}</button><span class="gap"> </span>to try again.<span class="status" role="status"></span>`;

function copy(view: CallbackPageView): {
  title: string;
  glyph: string;
  lede: string;
  note: string;
} {
  if (view.ok) {
    return {
      title: 'Signed in to the gt CLI',
      glyph: CHECK_CIRCLE,
      lede: 'You can close this tab and return to your terminal.',
      note: view.account
        ? `Signed in as <span class="ink">${escapeHtml(view.account)}</span>.`
        : '',
    };
  }
  if (view.reason === 'denied') {
    return {
      title: 'Request denied',
      glyph: X_CIRCLE,
      lede: 'You did not authorize the CLI, so nothing changed. You can close this tab.',
      note: RETRY,
    };
  }
  return {
    title: 'Sign-in failed',
    glyph: X_CIRCLE,
    lede: 'The CLI could not finish signing you in. Your terminal shows the reason.',
    note: RETRY,
  };
}

export function renderCallbackPage(view: CallbackPageView): string {
  const { title, glyph, lede, note } = copy(view);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<div class="plate">
${GT_MARK}
<h1>${glyph}<span>${title}</span></h1>
<p class="lede">${lede}</p>${note ? `\n<p class="note">${note}</p>` : ''}
</div>
</main>${note === RETRY ? `\n<script>${COPY_SCRIPT}</script>` : ''}
</body>
</html>`;
}
