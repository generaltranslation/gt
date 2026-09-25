// The page the loopback server shows once `gt login` has finished. It is
// served from 127.0.0.1 under `default-src 'none'; style-src 'unsafe-inline'`,
// so everything is inline: the brand deck's tokens (paper and ink with a
// prefers-color-scheme swap, ink-2 for the sentence, the status hues), the
// GT mark and the Heroicons 20/solid status glyph. No box and no rule: the
// page is one column of type on paper, the way the deck sets a statement.
// Nothing loads from the network and no webfont is requested; Inter is used
// when it is installed.
const STYLES = `
  :root {
    color-scheme: light dark;
    --ink: #070707;
    --ink-2: #3a3d44;
    --paper: #ffffff;
    --success: #12a37a;
    --danger: #e5484d;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #f2f2f0;
      --ink-2: #b9bcc3;
      --paper: #070707;
    }
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    background: var(--paper);
    color: var(--ink);
    font: 15px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: 100%;
    max-width: 440px;
  }
  svg { display: block; }
  .mark { width: 25px; height: 16px; margin-bottom: 40px; }
  .success, .error { width: 20px; height: 20px; margin-bottom: 14px; }
  .success { color: var(--success); }
  .error { color: var(--danger); }
  h1 {
    font-size: 22px;
    line-height: 1.2;
    font-weight: 500;
    letter-spacing: -0.018em;
    margin-bottom: 8px;
  }
  p { color: var(--ink-2); }
  .hint { margin-top: 12px; }
  code {
    font: 13.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--ink);
  }
`;

// The General Translation mark (Prototemplate src/components/viewer/GtMark.tsx).
const GT_MARK =
  '<svg class="mark" viewBox="-8 214 1213 771" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M363 222.5L1197 222.5L1196.5 283L834 283.5L832.5 976L773 975.5L772.5 398L359.5 398L341.5 401L301.5 414L271.5 430L249.5 446L231 463.5L214 484.5L190 529.5L180 567.5L178 613.5L185 653.5L196 682.5L217 717.5L242.5 746L270.5 768L314.5 790L342.5 798L372.5 802L399.5 802L430.5 798L475.5 783L502.5 768L524 751.5L523.5 747L415.5 748L414.5 684L583 684.5L583 923.5L580.5 926L516.5 955L476.5 967L439.5 974L403.5 977L355.5 976L326.5 973L287.5 965L252.5 954L221.5 941L187.5 923L155.5 902L121.5 874L97 849.5L77 825.5L55 793.5L33 752.5L15 705.5L4 656.5L0 613.5L2 556.5L10 511.5L23 469.5L44 423.5L66 387.5L99 346.5L129.5 317L170.5 286L225.5 256L275.5 237L325.5 226L363 222.5Z M386.5 282L322.5 288L275.5 301L220.5 327L167.5 365L123 413.5L103 443.5L87 474.5L71 518.5L61 578.5L63 641.5L68 669.5L78 703.5L107 762.5L143 810.5L171.5 838L194.5 856L248.5 887L305.5 907L366.5 916L403.5 916L442.5 912L490.5 900L523.5 887L524 826.5L479.5 847L440.5 858L399.5 863L344.5 860L291.5 846L254.5 829L214.5 802L186 775.5L165 749.5L141 708.5L125 664.5L118 624.5L118 573.5L126 530.5L139 494.5L165 449.5L201.5 408L238.5 379L292.5 352L341.5 339L373.5 336L773 336.5L772.5 283L386.5 282Z M888 337.5L1197 337.5L1196.5 398L949 398.5L948.5 976L888 975.5L888 337.5Z M415 571.5L692 572.5L692 830.5L668 858.5L633.5 890L631 890.5L631 635.5L414.5 635L415 571.5Z"/></svg>';

// Heroicons 20/solid check-circle and x-circle (MIT, Tailwind Labs).
const CHECK_CIRCLE =
  '<svg class="success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"/></svg>';
const X_CIRCLE =
  '<svg class="error" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"/></svg>';

export function renderCallbackPage(success: boolean): string {
  const title = success
    ? 'Successfully authenticated gt CLI'
    : 'Authentication failed';
  const hint = success
    ? ''
    : '\n<p class="hint">Run <code>npx gt login</code> again.</p>';
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
${GT_MARK}
${success ? CHECK_CIRCLE : X_CIRCLE}
<h1>${title}</h1>
<p>You may now close this tab and return to the terminal.</p>${hint}
</main>
</body>
</html>`;
}
