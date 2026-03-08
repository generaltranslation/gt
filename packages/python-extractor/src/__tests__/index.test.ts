import { describe, it, expect } from 'vitest';
import {
  extractFromPythonSource,
  PYTHON_GT_PACKAGES,
  PYTHON_GT_DEPENDENCIES,
  PYTHON_T_FUNCTION,
  PYTHON_METADATA_KWARGS,
} from '../index.js';
import type { ExtractionResult, ExtractionMetadata } from '../types.js';

describe('python-extractor', () => {
  describe('extractFromPythonSource', () => {
    it('throws "Not implemented" error', () => {
      expect(() => extractFromPythonSource('', 'test.py')).toThrow(
        'Not implemented: Python extraction is under development'
      );
    });
  });

  describe('types', () => {
    it('ExtractionResult type is usable', () => {
      const result: ExtractionResult = {
        dataFormat: 'ICU',
        source: 'Hello',
        metadata: { id: 'greeting' },
      };
      expect(result.dataFormat).toBe('ICU');
      expect(result.source).toBe('Hello');
      expect(result.metadata.id).toBe('greeting');
    });

    it('ExtractionMetadata supports all optional fields', () => {
      const metadata: ExtractionMetadata = {
        id: 'test',
        context: 'casual',
        maxChars: 100,
        filePaths: ['file.py'],
        staticId: 'static-1',
      };
      expect(metadata.id).toBe('test');
      expect(metadata.context).toBe('casual');
      expect(metadata.maxChars).toBe(100);
      expect(metadata.filePaths).toEqual(['file.py']);
      expect(metadata.staticId).toBe('static-1');
    });
  });

  describe('constants', () => {
    it('exports PYTHON_GT_PACKAGES', () => {
      expect(PYTHON_GT_PACKAGES).toEqual(['gt_flask', 'gt_fastapi']);
    });

    it('exports PYTHON_GT_DEPENDENCIES', () => {
      expect(PYTHON_GT_DEPENDENCIES).toEqual(['gt-flask', 'gt-fastapi']);
    });

    it('exports PYTHON_T_FUNCTION', () => {
      expect(PYTHON_T_FUNCTION).toBe('t');
    });

    it('exports PYTHON_METADATA_KWARGS', () => {
      expect(PYTHON_METADATA_KWARGS).toEqual({
        _id: 'id',
        _context: 'context',
        _maxChars: 'maxChars',
      });
    });
  });
});
