import { describe, it, expect } from 'vitest';
import { mapExtractionResultsToUpdates } from '../mapToUpdates.js';
import type { ExtractionResult } from '@generaltranslation/python-extractor';

describe('mapExtractionResultsToUpdates', () => {
  it('maps empty results to empty updates', () => {
    const updates = mapExtractionResultsToUpdates([]);
    expect(updates).toEqual([]);
  });

  it('maps single result with all metadata fields', () => {
    const results: ExtractionResult[] = [
      {
        dataFormat: 'ICU',
        source: 'Hello, {name}!',
        metadata: {
          id: 'greeting',
          context: 'casual',
          maxChars: 100,
          filePaths: ['app.py'],
          staticId: 'static-1',
        },
      },
    ];

    const updates = mapExtractionResultsToUpdates(results);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'Hello, {name}!',
      metadata: {
        id: 'greeting',
        context: 'casual',
        maxChars: 100,
        filePaths: ['app.py'],
        staticId: 'static-1',
      },
    });
  });

  it('passes through dataFormat correctly', () => {
    const results: ExtractionResult[] = [
      {
        dataFormat: 'JSX',
        source: '<p>Hello</p>',
        metadata: {},
      },
    ];

    const updates = mapExtractionResultsToUpdates(results);
    expect(updates[0].dataFormat).toBe('JSX');
  });

  it('handles missing optional metadata', () => {
    const results: ExtractionResult[] = [
      {
        dataFormat: 'ICU',
        source: 'Simple string',
        metadata: {},
      },
    ];

    const updates = mapExtractionResultsToUpdates(results);

    expect(updates).toHaveLength(1);
    expect(updates[0].metadata).toEqual({});
    expect(updates[0].metadata.id).toBeUndefined();
    expect(updates[0].metadata.context).toBeUndefined();
    expect(updates[0].metadata.maxChars).toBeUndefined();
  });

  it('preserves filePaths array', () => {
    const results: ExtractionResult[] = [
      {
        dataFormat: 'ICU',
        source: 'Multi-file string',
        metadata: {
          filePaths: ['routes/index.py', 'routes/auth.py'],
        },
      },
    ];

    const updates = mapExtractionResultsToUpdates(results);
    expect(updates[0].metadata.filePaths).toEqual([
      'routes/index.py',
      'routes/auth.py',
    ]);
  });

  it('maps multiple results', () => {
    const results: ExtractionResult[] = [
      {
        dataFormat: 'ICU',
        source: 'Hello',
        metadata: { id: 'hello' },
      },
      {
        dataFormat: 'ICU',
        source: 'Goodbye',
        metadata: { id: 'goodbye', context: 'farewell' },
      },
    ];

    const updates = mapExtractionResultsToUpdates(results);
    expect(updates).toHaveLength(2);
    expect(updates[0].source).toBe('Hello');
    expect(updates[1].source).toBe('Goodbye');
    expect(updates[1].metadata.context).toBe('farewell');
  });
});
