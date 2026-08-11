import type { VueProjectExtractionResult } from '../../types.js';
import { describe, expect, it } from 'vitest';
import { mergeVueProjectExtraction } from '../../project.js';

describe('mergeVueProjectExtraction', () => {
  it('preserves primary ordering and combines diagnostics without deduplicating primary warnings', () => {
    const primaryUpdate = update('Primary', 'primary-hash', ['primary.tsx']);
    const vueUpdate = update('Vue', 'vue-hash', ['component.vue']);
    const primaryWarnings = [
      'shared warning',
      'primary warning',
      'shared warning',
    ];

    const result = mergeVueProjectExtraction(
      {
        updates: [primaryUpdate],
        errors: ['primary error'],
        warnings: primaryWarnings,
      },
      {
        updates: [vueUpdate],
        errors: ['vue error'],
        warnings: ['shared warning', 'vue warning'],
      }
    );

    expect(result.updates).toEqual([primaryUpdate, vueUpdate]);
    expect(result.errors).toEqual(['primary error', 'vue error']);
    expect(result.warnings).toEqual([
      'shared warning',
      'primary warning',
      'shared warning',
      'shared warning',
      'vue warning',
    ]);
    expect(primaryWarnings).toEqual([
      'shared warning',
      'primary warning',
      'shared warning',
    ]);
  });

  it('deduplicates hash collisions without mutating primary updates', () => {
    const primaryUpdate = update('Shared', 'shared-hash', ['primary.tsx']);
    const primarySnapshot = structuredClone(primaryUpdate);

    const result = mergeVueProjectExtraction(
      { updates: [primaryUpdate], errors: [], warnings: [] },
      {
        updates: [
          update('Shared', 'shared-hash', ['component.vue', 'primary.tsx']),
        ],
        errors: [],
        warnings: [],
      }
    );

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).not.toBe(primaryUpdate);
    expect(result.updates[0]?.metadata.filePaths).toEqual([
      'primary.tsx',
      'component.vue',
    ]);
    expect(primaryUpdate).toEqual(primarySnapshot);
  });

  it('merges source context into a copy for a matching Vue hash', () => {
    const duplicate = { before: 'before', target: 'target', after: 'after' };
    const distinct = { before: 'other', target: 'target', after: 'after' };
    const primaryUpdate = update('Shared', 'shared-hash', ['src/shared.tsx']);
    primaryUpdate.metadata.sourceCode = {
      'src/shared.tsx': [structuredClone(duplicate)],
    };
    const primarySourceCode = primaryUpdate.metadata.sourceCode;
    const primaryEntries = primarySourceCode['src/shared.tsx'];
    const vueUpdate = update('Shared', 'shared-hash', ['src/shared.tsx']);
    vueUpdate.metadata.sourceCode = {
      'src/shared.tsx': [structuredClone(duplicate), distinct],
    };

    const result = mergeVueProjectExtraction(
      { updates: [primaryUpdate], errors: [], warnings: [] },
      { updates: [vueUpdate], errors: [], warnings: [] }
    );

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.metadata.sourceCode).toEqual({
      'src/shared.tsx': [duplicate, distinct],
    });
    expect(primaryUpdate.metadata.sourceCode).toEqual({
      'src/shared.tsx': [duplicate],
    });
    expect(primaryUpdate.metadata.sourceCode).toBe(primarySourceCode);
    expect(primaryUpdate.metadata.sourceCode['src/shared.tsx']).toBe(
      primaryEntries
    );
    expect(result.updates[0]?.metadata.sourceCode).not.toBe(primarySourceCode);
  });
});

function update(
  source: string,
  hash: string,
  filePaths: string[]
): VueProjectExtractionResult {
  return {
    dataFormat: 'STRING',
    source,
    metadata: { hash, filePaths },
  };
}
