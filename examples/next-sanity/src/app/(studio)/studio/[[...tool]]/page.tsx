import { NextStudio } from 'next-sanity/studio';
import Link from 'next/link';
import config from '../../../../../sanity.config';
import { isSanityConfigured } from '@/sanity/env';

export const dynamic = 'force-static';

export { metadata, viewport } from 'next-sanity/studio';

export default function StudioPage() {
  if (!isSanityConfigured) {
    return (
      <main
        style={{
          display: 'grid',
          minHeight: '100vh',
          placeItems: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <section style={{ maxWidth: '38rem' }}>
          <p style={{ color: '#6b7280', fontWeight: 700 }}>SANITY STUDIO</p>
          <h1>Connect a Sanity project</h1>
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code>, set{' '}
            <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code>, and restart the dev
            server. The embedded Studio will then load at this route.
          </p>
          <Link href='/'>Return to the example</Link>
        </section>
      </main>
    );
  }

  return <NextStudio config={config} />;
}
