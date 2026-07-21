import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getReactSetupGuidance,
  LOAD_TRANSLATIONS_SETUP_GUIDANCE,
  NEXT_APP_QUICKSTART_URL,
  NEXT_PAGES_QUICKSTART_URL,
  REACT_CONFIGURING_GUIDE_URL,
  REACT_LOAD_TRANSLATIONS_URL,
  REACT_SERVER_QUICKSTART_URL,
  REACT_SPA_QUICKSTART_URL,
} from '../guidance.js';

describe('getReactSetupGuidance', () => {
  it('directs Vite SPAs to initializeGTSPA without GTProvider', () => {
    const guidance = getReactSetupGuidance({ name: 'vite', type: 'react' });

    expect(guidance.promptAction).toContain('initializeGTSPA');
    expect(guidance.completion).toContain('Do not add a GTProvider');
    expect(guidance.docsUrl).toBe(REACT_SPA_QUICKSTART_URL);
  });

  it.each(['gatsby', 'redwood'] as const)(
    'directs %s apps to initializeGT and hydrate GTProvider',
    (name) => {
      const guidance = getReactSetupGuidance({ name, type: 'react' });

      expect(guidance.promptAction).toContain('initializeGT');
      expect(guidance.completion).toContain(
        'hydrate GTProvider with both values'
      );
      expect(guidance.completion).toContain('locale and translations');
      expect(guidance.docsUrl).toBe(REACT_SERVER_QUICKSTART_URL);
    }
  );

  it('explains both rendering models when generic React is detected', () => {
    const guidance = getReactSetupGuidance({ name: 'react', type: 'react' });

    expect(guidance.completion).toContain('SPAs call initializeGTSPA');
    expect(guidance.completion).toContain(
      'Server-rendered apps call initializeGT'
    );
    expect(guidance.docsUrl).toBe(REACT_CONFIGURING_GUIDE_URL);
  });

  it('uses the current Next.js quickstarts', () => {
    expect(
      getReactSetupGuidance({ name: 'next-app', type: 'react' }).docsUrl
    ).toBe(NEXT_APP_QUICKSTART_URL);
    expect(
      getReactSetupGuidance({ name: 'next-pages', type: 'react' }).docsUrl
    ).toBe(NEXT_PAGES_QUICKSTART_URL);
  });
});

describe('setup instruction guidance', () => {
  it('points loader help to the React loader reference', () => {
    expect(LOAD_TRANSLATIONS_SETUP_GUIDANCE).toContain('initializeGTSPA');
    expect(LOAD_TRANSLATIONS_SETUP_GUIDANCE).toContain('initializeGT');
    expect(LOAD_TRANSLATIONS_SETUP_GUIDANCE).toContain(
      REACT_LOAD_TRANSLATIONS_URL
    );
  });

  it('bundles distinct SPA and server-rendered React instructions', () => {
    const instructions = fs.readFileSync(
      new URL('../instructions/gt-react.md', import.meta.url),
      'utf8'
    );

    expect(instructions).toContain('SPAs do not need a `GTProvider`');
    expect(instructions).toContain('initializeGTSPA()');
    expect(instructions).toContain('initializeGT()');
    expect(instructions).toContain(
      '<GTProvider locale={locale} translations={translations}>'
    );
    expect(instructions).toContain(REACT_SPA_QUICKSTART_URL);
    expect(instructions).toContain(REACT_SERVER_QUICKSTART_URL);
    expect(instructions).not.toContain(
      'https://generaltranslation.com/docs/react.md'
    );
  });

  it('bundles the current Next.js quickstart', () => {
    const instructions = fs.readFileSync(
      new URL('../instructions/gt-next.md', import.meta.url),
      'utf8'
    );

    expect(instructions).toContain(NEXT_APP_QUICKSTART_URL);
    expect(instructions).not.toContain(
      'https://generaltranslation.com/docs/next.md'
    );
  });
});
