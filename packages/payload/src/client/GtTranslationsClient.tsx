'use client';
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
        gap: 'calc(var(--base) * 2)',
        padding: 'calc(var(--base) * 2) 0',
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 'calc(var(--base) * 1.5)',
          maxWidth: 800,
        }}
      >
        <header>
          <h1 style={{ margin: 0 }}>Translations</h1>
          <p style={{ margin: 'calc(var(--base) / 3) 0 0', opacity: 0.7 }}>
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
