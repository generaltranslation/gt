// Mirrors the terminal state of the dashboard's device-approval screen
// (gt-cloud apps/dashboard/.../signin/device/_components/DeviceApproval.tsx):
// a 48px lucide status icon, 18px semibold heading, 14px muted body, centered
// in a 400px column. Tokens are copied from gt-cloud packages/ui shared.css
// because this page is served from 127.0.0.1 with no external assets.
const STYLES = `
  :root {
    color-scheme: light dark;
    --background: #fff;
    --foreground: #09090b;
    --muted-foreground: #71717a;
    --success: #1cca5b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --background: #09090b;
      --foreground: #fafafa;
      --muted-foreground: #a1a1aa;
      --success: #387836;
    }
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    background: var(--background);
    color: var(--foreground);
    font: 14px/20px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: 100%;
    max-width: 400px;
    text-align: center;
  }
  svg {
    display: block;
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
  }
  .success { color: var(--success); }
  h1 {
    font-size: 18px;
    line-height: 28px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }
  p { color: var(--muted-foreground); }
`;

const CIRCLE_CHECK =
  '<svg class="success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
const page = {
  title: 'Return to your terminal',
  icon: CIRCLE_CHECK,
  body: 'You can close this window. Check your terminal for the sign-in result.',
};

export function renderCallbackPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
${page.icon}
<h1>${page.title}</h1>
<p>${page.body}</p>
</main>
</body>
</html>`;
}
