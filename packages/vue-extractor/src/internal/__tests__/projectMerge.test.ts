import type { VueProjectExtractionResult } from '../../types.js';
import { describe, expect, it } from 'vitest';
import { mergeVueProjectExtraction } from '../../project.js';

describe('mergeVueProjectExtraction', () => {
  it('preserves primary ordering and combines diagnostics', () => {
    const primaryUpdate = update('Primary', 'primary-hash', ['primary.tsx']);
    const vueUpdate = update('Vue', 'vue-hash', ['component.vue']);

    const result = mergeVueProjectExtraction(
      {
        updates: [primaryUpdate],
        errors: ['primary error'],
        warnings: ['shared warning', 'primary warning'],
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
      'vue warning',
    ]);
  });

  it('deduplicates hash collisions and merges their file paths', () => {
    const primaryUpdate = update('Shared', 'shared-hash', ['primary.tsx']);

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
    expect(result.updates[0]).toBe(primaryUpdate);
    expect(result.updates[0]?.metadata.filePaths).toEqual([
      'primary.tsx',
      'component.vue',
    ]);
  });

  it('deduplicates identical source context and preserves distinct locations', () => {
    const duplicate = { before: 'before', target: 'target', after: 'after' };
    const distinct = { before: 'other', target: 'target', after: 'after' };
    const primaryUpdate = update('Shared', 'shared-hash', ['src/shared.tsx']);
    primaryUpdate.metadata.sourceCode = {
      'src/shared.tsx': [structuredClone(duplicate)],
    };
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
