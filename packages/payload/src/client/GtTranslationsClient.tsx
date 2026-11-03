'use client';
import { SetStepNav } from '@payloadcms/ui';
import React, { useState } from 'react';
import { CoverageTable } from './CoverageTable';
import { TranslatePanel } from './TranslatePanel';

// The Translations page: translate the whole site, and see which languages
// each document has text in.
export function GtTranslationsClient() {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div
      data-testid='gt-translations'
      style={{
        display: 'grid',
        gap: 'var(--spacer-6)',
        padding: 'var(--spacer-6) 0',
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 'var(--spacer-4)',
          maxWidth: 800,
        }}
      >
        <SetStepNav nav={[{ label: 'Translations' }]} />
        <header>
          {/* Payload 4 leaves headings unstyled; use its title tokens. */}
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--text-heading-xl-font-size)',
              lineHeight: 'var(--text-heading-xl-line-height)',
              fontWeight: 'var(--text-heading-xl-font-weight)',
            }}
          >
            Translations
          </h1>
          <p style={{ margin: 'var(--spacer-1-5) 0 0', opacity: 0.7 }}>
            Translate your whole site.
          </p>
        </header>
        <TranslatePanel
          scope={{ site: true }}
          onTranslated={() => setReloadKey((key) => key + 1)}
        />
      </div>
      <CoverageTable reloadKey={reloadKey} />
    </div>
  );
}
