import { describe, it, expect } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import { matchSetupPyDependency } from '../matchSetupPyDependency.js';

describe('matchSetupPyDependency', () => {
  // ---- Basic detection ----

  it('detects gt-fastapi in install_requires list', () => {
    const content = `
from setuptools import setup
setup(
    name="myapp",
    install_requires=["gt-fastapi>=1.0.0", "uvicorn"],
)
`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FASTAPI);
  });

  it('detects gt-flask in install_requires list', () => {
    const content = `
setup(
    install_requires=[
        "flask>=2.0",
        "gt-flask>=1.0.0",
    ],
)
`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects gt-flask in extras_require', () => {
    const content = `
setup(
    extras_require={
        "i18n": ["gt-flask>=1.0.0"],
    },
)
`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- PEP 503 normalization ----

  it('detects gt_flask underscore variant', () => {
    const content = `install_requires=["gt_flask"]`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects GT-Flask mixed case', () => {
    const content = `install_requires=["GT-Flask>=1.0"]`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- Quote styles ----

  it('handles single-quoted strings', () => {
    const content = `install_requires=['gt-flask>=1.0']`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles mixed quote styles', () => {
    const content = `install_requires=['flask', "gt-flask>=1.0"]`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- Version specifiers ----

  it('handles dependency with extras', () => {
    const content = `install_requires=["gt-flask[redis]>=1.0"]`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles exact version', () => {
    const content = `install_requires=["gt-flask==1.2.3"]`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- False positive prevention ----

  it('does not match name= field containing gt-flask', () => {
    const content = `
setup(
    name="gt-flask",
    version="1.0.0",
    install_requires=["flask"],
)
`;
    // "gt-flask" appears in name, NOT in install_requires
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('does not match description containing gt-flask', () => {
    const content = `
setup(
    name="myapp",
    description="A wrapper for gt-flask",
    install_requires=["flask"],
)
`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('does not match gt-flask in comments', () => {
    const content = `
# This setup uses gt-flask for i18n
setup(
    install_requires=["flask"],
)
`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('does not match gt-flask in a string outside install_requires', () => {
    const content = `
setup(
    name="myapp",
    url="https://example.com/gt-flask",
    install_requires=["flask"],
)
`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('does not match unquoted variable names', () => {
    const content = `
import gt_flask_utils
gt_flask_version = "1.0"
`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('does not match partial quoted names in install_requires', () => {
    const content = `install_requires=["my-gt-flask-wrapper"]`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('does not match gt-flask-extra in install_requires', () => {
    const content = `install_requires=["gt-flask-extra>=1.0"]`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  // ---- Whitespace / formatting ----

  it('handles spaces around equals sign', () => {
    const content = `install_requires = ["gt-flask>=1.0"]`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('handles multiline install_requires', () => {
    const content = `
setup(
    install_requires = [
        "flask",
        "gt-flask>=1.0.0",
        "requests",
    ],
)
`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- Edge cases ----

  it('returns null for empty content', () => {
    expect(matchSetupPyDependency('')).toBeNull();
  });

  it('returns null when no install_requires or extras_require exists', () => {
    const content = `
setup(
    name="myapp",
    version="1.0",
)
`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('returns null when install_requires has no GT packages', () => {
    const content = `install_requires=["flask", "requests", "sqlalchemy"]`;
    expect(matchSetupPyDependency(content)).toBeNull();
  });

  it('handles nested brackets in extras_require', () => {
    const content = `
setup(
    extras_require={
        "i18n": [
            "gt-flask>=1.0",
        ],
        "dev": [
            "pytest",
        ],
    },
)
`;
    expect(matchSetupPyDependency(content)).toBe(Libraries.GT_FLASK);
  });
});
