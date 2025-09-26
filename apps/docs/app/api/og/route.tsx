import { ImageResponse } from 'next/og';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = new URL(request.url).origin;
  const title =
    searchParams.get('t') || searchParams.get('title') || 'Documentation';
  const description =
    searchParams.get('d') ||
    searchParams.get('desc') ||
    'General Translation Docs';
  const section = (
    searchParams.get('s') ||
    searchParams.get('section') ||
    ''
  ).toUpperCase();
  const theme = (searchParams.get('theme') || 'dark').toLowerCase();

  const isLight = theme === 'light';
  const bgGrad = isLight ? '#ffffff' : '#000000';
  const fg = isLight ? '#0b1220' : '#e6eaf2';
  const subtle = isLight ? 'rgba(0,0,0,0.7)' : 'rgba(230,234,242,0.75)';

  // Read PNG logo from public and embed as data URL so OG renderer doesn't need network fetch
  const logoFile = isLight
    ? 'no-bg-gt-logo-light.png'
    : 'no-bg-gt-logo-dark.png';
  const logoPath = path.join(process.cwd(), 'public', logoFile);
  let logoDataUrl = `${origin}/${logoFile}`; // fallback to absolute URL
  try {
    const buf = await fs.readFile(logoPath);
    logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    // ignore, fall back to absolute URL
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: bgGrad,
          color: fg,
          padding: '60px',
        }}
      >
        {/* Top-left: Logo only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img
            src={logoDataUrl}
            width={80}
            height={80}
            alt="General Translation"
            style={{ display: 'flex' }}
          />
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 600 }}>
            General Translation
          </div>
        </div>

        {/* Bottom-left: Section, Title, Subtitle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 60,
          }}
        >
          {section && (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 700,
                color: fg,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ display: 'flex' }}>{section}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: 84,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              wordWrap: 'break-word',
              maxWidth: 900,
            }}
          >
            <span style={{ display: 'flex' }}>{title}</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              color: subtle,
              maxWidth: 720,
              lineHeight: 1.3,
              wordWrap: 'break-word',
            }}
          >
            <span style={{ display: 'flex' }}>{description}</span>
          </div>
        </div>
        {/* Bottom-right: site URL */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            right: 60,
            bottom: 40,
            fontSize: 24,
            color: subtle,
          }}
        >
          <span style={{ display: 'flex' }}>generaltranslation.com/docs</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
