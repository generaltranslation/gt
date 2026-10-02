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
  .mark { width: 25px; height: 16px; margin-bottom: 32px; }
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
  /* A button reset to inline text. Selecting the whole command on one click
     is the fallback when the copy fails. */
  .cmd {
    all: unset;
    font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--ink);
    cursor: pointer;
    user-select: all;
    -webkit-user-select: all;
  }
  .cmd:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
`;

// Copies the retry command and says so for 1.6s. A failed copy leaves the
// command selected, so Cmd+C still works.
const COPY_SCRIPT = `const cmd = document.querySelector('.cmd');
const status = document.querySelector('.copied');
let timer;
cmd.addEventListener('click', () => {
  navigator.clipboard.writeText(cmd.textContent).then(() => {
    getSelection().removeAllRanges();
    status.textContent = ' Copied.';
    clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ''; }, 1600);
  }, () => {});
});`;

/** The policy the loopback server sends with the page. */
export const CALLBACK_PAGE_CSP = `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${createHash('sha256').update(COPY_SCRIPT).digest('base64')}'`;

// The General Translation mark, from the brand asset set.
const GT_MARK =
  '<svg class="mark" viewBox="-8 214 1213 771" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M363 222.5L1197 222.5L1196.5 283L834 283.5L832.5 976L773 975.5L772.5 398L359.5 398L341.5 401L301.5 414L271.5 430L249.5 446L231 463.5L214 484.5L190 529.5L180 567.5L178 613.5L185 653.5L196 682.5L217 717.5L242.5 746L270.5 768L314.5 790L342.5 798L372.5 802L399.5 802L430.5 798L475.5 783L502.5 768L524 751.5L523.5 747L415.5 748L414.5 684L583 684.5L583 923.5L580.5 926L516.5 955L476.5 967L439.5 974L403.5 977L355.5 976L326.5 973L287.5 965L252.5 954L221.5 941L187.5 923L155.5 902L121.5 874L97 849.5L77 825.5L55 793.5L33 752.5L15 705.5L4 656.5L0 613.5L2 556.5L10 511.5L23 469.5L44 423.5L66 387.5L99 346.5L129.5 317L170.5 286L225.5 256L275.5 237L325.5 226L363 222.5Z M386.5 282L322.5 288L275.5 301L220.5 327L167.5 365L123 413.5L103 443.5L87 474.5L71 518.5L61 578.5L63 641.5L68 669.5L78 703.5L107 762.5L143 810.5L171.5 838L194.5 856L248.5 887L305.5 907L366.5 916L403.5 916L442.5 912L490.5 900L523.5 887L524 826.5L479.5 847L440.5 858L399.5 863L344.5 860L291.5 846L254.5 829L214.5 802L186 775.5L165 749.5L141 708.5L125 664.5L118 624.5L118 573.5L126 530.5L139 494.5L165 449.5L201.5 408L238.5 379L292.5 352L341.5 339L373.5 336L773 336.5L772.5 283L386.5 282Z M888 337.5L1197 337.5L1196.5 398L949 398.5L948.5 976L888 975.5L888 337.5Z M415 571.5L692 572.5L692 830.5L668 858.5L633.5 890L631 890.5L631 635.5L414.5 635L415 571.5Z"/></svg>';

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
const RETRY =
  'Run<span class="gap"> </span><button type="button" class="cmd" aria-label="Copy npx gt login">npx gt login</button><span class="gap"> </span>to try again.<span class="copied" role="status"></span>';

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
