import { describe, it, expect } from 'vitest';
import {
  Libraries,
  isPythonLibrary,
  INLINE_LIBRARIES,
  GT_LIBRARIES_UPSTREAM,
  PYTHON_LIBRARIES,
} from '../libraries.js';

describe('Python library types', () => {
  it('isPythonLibrary returns true for gt-flask', () => {
    expect(isPythonLibrary('gt-flask')).toBe(true);
  });

  it('isPythonLibrary returns true for gt-fastapi', () => {
    expect(isPythonLibrary('gt-fastapi')).toBe(true);
  });

  it('isPythonLibrary returns false for gt-react', () => {
    expect(isPythonLibrary('gt-react')).toBe(false);
  });

  it('isPythonLibrary returns false for arbitrary strings', () => {
    expect(isPythonLibrary('flask')).toBe(false);
    expect(isPythonLibrary('base')).toBe(false);
  });

  it('GT_FLASK and GT_FASTAPI are in INLINE_LIBRARIES', () => {
    expect(
      (INLINE_LIBRARIES as readonly string[]).includes(Libraries.GT_FLASK)
    ).toBe(true);
    expect(
      (INLINE_LIBRARIES as readonly string[]).includes(Libraries.GT_FASTAPI)
    ).toBe(true);
  });

  it('GT_LIBRARIES_UPSTREAM has entries for both Python libraries', () => {
    expect(GT_LIBRARIES_UPSTREAM[Libraries.GT_FLASK]).toBeDefined();
    expect(GT_LIBRARIES_UPSTREAM[Libraries.GT_FASTAPI]).toBeDefined();
    expect(GT_LIBRARIES_UPSTREAM[Libraries.GT_FLASK]).toContain(
      Libraries.GT_FLASK
    );
    expect(GT_LIBRARIES_UPSTREAM[Libraries.GT_FASTAPI]).toContain(
      Libraries.GT_FASTAPI
    );
  });

  it('PYTHON_LIBRARIES contains both Python libraries', () => {
    expect(PYTHON_LIBRARIES).toContain(Libraries.GT_FLASK);
    expect(PYTHON_LIBRARIES).toContain(Libraries.GT_FASTAPI);
    expect(PYTHON_LIBRARIES).toHaveLength(2);
  });
});
