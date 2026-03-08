import { describe, it, expect } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import { matchPyprojectDependency } from '../matchPyprojectDependency.js';

describe('matchPyprojectDependency', () => {
  // ---- Basic detection ----

  it('detects gt-flask in [project] dependencies array', () => {
    const content = `[project]
name = "myapp"
dependencies = [
  "flask>=2.0",
  "gt-flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects gt-flask in [project.dependencies] array', () => {
    const content = `[project]
name = "myapp"

[project.dependencies]
dependencies = [
  "flask>=2.0",
  "gt-flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects gt-fastapi in poetry-style key = "version"', () => {
    const content = `[tool.poetry.dependencies]
python = "^3.9"
gt-fastapi = "^1.0.0"
fastapi = "^0.100.0"
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FASTAPI);
  });

  it('detects gt-flask in optional-dependencies', () => {
    const content = `[project.optional-dependencies.i18n]
dependencies = [
  "gt-flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects in poetry dev dependencies', () => {
    const content = `[tool.poetry.group.dev.dependencies]
gt-flask = "^1.0.0"
pytest = "^7.0"
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects in poetry test group dependencies', () => {
    const content = `[tool.poetry.group.test.dependencies]
gt-fastapi = "^1.0.0"
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FASTAPI);
  });

  // ---- PEP 503 normalization ----

  it('handles underscore variant gt_flask in array', () => {
    const content = `[project]
dependencies = [
  "gt_flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles underscore variant in poetry key', () => {
    const content = `[tool.poetry.dependencies]
gt_fastapi = "^1.0.0"
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FASTAPI);
  });

  it('handles period variant gt.flask in array', () => {
    const content = `[project]
dependencies = [
  "gt.flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles mixed case GT-Flask in array', () => {
    const content = `[project]
dependencies = [
  "GT-Flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- Array format variations ----

  it('handles inline array on one line', () => {
    const content = `[project]
dependencies = ["flask", "gt-flask>=1.0"]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles empty dependencies array', () => {
    const content = `[project]
dependencies = []
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('handles single-quoted strings in array', () => {
    const content = `[project]
dependencies = [
  'gt-flask>=1.0.0',
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles dependency with extras in array', () => {
    const content = `[project]
dependencies = [
  "gt-flask[redis]>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles compact array without spaces', () => {
    const content = `[project]
dependencies=["gt-flask"]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- Poetry table format variations ----

  it('handles poetry inline table syntax', () => {
    const content = `[tool.poetry.dependencies]
gt-flask = {version = "^1.0", optional = true}
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- False positive prevention ----

  it('ignores gt-flask in non-dependency sections', () => {
    const content = `[project]
name = "gt-flask-example"
description = "An app using gt-flask"

[project.urls]
homepage = "https://example.com/gt-flask"

[build-system]
requires = ["setuptools"]
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('ignores gt-flask in comments within dependency array', () => {
    const content = `[project]
dependencies = [
  # We used to use gt-flask but switched
  "flask>=2.0",
]
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('does not match partial package names in array', () => {
    const content = `[project]
dependencies = [
  "not-gt-flask>=1.0.0",
  "gt-flask-extra>=1.0.0",
  "gt-flaskify>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('does not match partial package names in poetry keys', () => {
    const content = `[tool.poetry.dependencies]
gt-flask-utils = "^1.0.0"
not-gt-flask = "^1.0.0"
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('stops matching when a new non-dependency section starts', () => {
    const content = `[tool.poetry.dependencies]
flask = "^2.0"

[project.urls]
gt-flask = "https://example.com"
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('does not false-positive on keys starting with "dependencies" prefix', () => {
    const content = `[project]
dependencies_file = "deps.txt"
dependencies_list = ["gt-flask"]
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('does not false-positive on [build-system] requires containing gt-flask', () => {
    const content = `[build-system]
requires = ["gt-flask"]
`;
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  it('ignores gt-flask in TOML multiline string under [project]', () => {
    const content = `[project]
description = """
This project wraps gt-flask for better ergonomics.
"""
`;
    // "gt-flask" appears in a multiline string value, not a dependency array
    expect(matchPyprojectDependency(content)).toBeNull();
  });

  // ---- Whitespace / formatting edge cases ----

  it('handles Windows line endings', () => {
    const content =
      '[project]\r\ndependencies = [\r\n  "gt-flask>=1.0.0",\r\n]\r\n';
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles extra whitespace around section headers', () => {
    // TOML spec doesn't allow spaces inside brackets, but be defensive
    const content = `[project]
dependencies = [
  "gt-flask",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('returns null for empty content', () => {
    expect(matchPyprojectDependency('')).toBeNull();
  });

  it('returns null for content with no sections', () => {
    expect(matchPyprojectDependency('gt-flask = "1.0"')).toBeNull();
  });

  // ---- Multiple dependency locations ----

  it('finds gt-flask even if it appears later after non-matching deps', () => {
    const content = `[project]
dependencies = [
  "flask>=2.0",
  "requests>=2.28",
  "sqlalchemy>=2.0",
  "gt-flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('finds gt-flask in optional-deps even when main deps exist without it', () => {
    const content = `[project]
dependencies = [
  "flask>=2.0",
]

[project.optional-dependencies.i18n]
dependencies = [
  "gt-flask>=1.0.0",
]
`;
    expect(matchPyprojectDependency(content)).toBe(Libraries.GT_FLASK);
  });
});
