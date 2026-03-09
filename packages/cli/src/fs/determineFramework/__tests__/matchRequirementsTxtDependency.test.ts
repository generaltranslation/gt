import { describe, it, expect } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import { matchRequirementsTxtDependency } from '../matchRequirementsTxtDependency.js';

describe('matchRequirementsTxtDependency', () => {
  // ---- Basic detection ----

  it('detects plain gt-flask', () => {
    expect(matchRequirementsTxtDependency('gt-flask\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('detects gt-fastapi', () => {
    expect(matchRequirementsTxtDependency('gt-fastapi\n')).toBe(
      Libraries.GT_FASTAPI
    );
  });

  it('detects gt-flask among other packages', () => {
    const content = 'flask\nuvicorn\ngt-flask\nrequests\n';
    expect(matchRequirementsTxtDependency(content)).toBe(Libraries.GT_FLASK);
  });

  // ---- Version specifier formats ----

  it('handles >= version specifier', () => {
    expect(matchRequirementsTxtDependency('gt-flask>=1.0.0\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles == exact version', () => {
    expect(matchRequirementsTxtDependency('gt-flask==1.2.3\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles ~= compatible version', () => {
    expect(matchRequirementsTxtDependency('gt-flask~=1.0\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles != exclusion', () => {
    expect(matchRequirementsTxtDependency('gt-flask!=1.0.0\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles < and > specifiers', () => {
    expect(matchRequirementsTxtDependency('gt-flask>1.0,<2.0\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  // ---- PEP 503 normalization ----

  it('detects gt_flask underscore variant', () => {
    expect(matchRequirementsTxtDependency('gt_flask\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('detects GT-Flask mixed case', () => {
    expect(matchRequirementsTxtDependency('GT-Flask\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('detects gt.flask period variant', () => {
    expect(matchRequirementsTxtDependency('gt.flask\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  // ---- Extras syntax ----

  it('handles extras syntax [redis]', () => {
    expect(matchRequirementsTxtDependency('gt-flask[redis]>=1.0\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles multiple extras', () => {
    expect(
      matchRequirementsTxtDependency('gt-flask[redis,celery]>=1.0\n')
    ).toBe(Libraries.GT_FLASK);
  });

  // ---- Environment markers ----

  it('handles environment markers with semicolon', () => {
    expect(
      matchRequirementsTxtDependency('gt-flask>=1.0; python_version >= "3.8"\n')
    ).toBe(Libraries.GT_FLASK);
  });

  // ---- URL-based requirements ----

  it('handles @ URL syntax', () => {
    expect(
      matchRequirementsTxtDependency(
        'gt-flask @ https://example.com/gt-flask-1.0.tar.gz\n'
      )
    ).toBe(Libraries.GT_FLASK);
  });

  // ---- Comments ----

  it('ignores full-line comments containing gt-flask', () => {
    expect(
      matchRequirementsTxtDependency('# gt-flask is not installed\nflask\n')
    ).toBeNull();
  });

  it('ignores inline comments after unrelated package name', () => {
    expect(
      matchRequirementsTxtDependency('flask # replaces gt-flask\n')
    ).toBeNull();
  });

  it('detects gt-flask even with inline comment after it', () => {
    expect(
      matchRequirementsTxtDependency('gt-flask>=1.0 # i18n support\n')
    ).toBe(Libraries.GT_FLASK);
  });

  // ---- Pip flags / directives ----

  it('ignores -r include directive', () => {
    expect(
      matchRequirementsTxtDependency('-r other-requirements.txt\nflask\n')
    ).toBeNull();
  });

  it('ignores --index-url directive', () => {
    expect(
      matchRequirementsTxtDependency(
        '--index-url https://pypi.org/simple\nflask\n'
      )
    ).toBeNull();
  });

  it('ignores -e editable install', () => {
    expect(
      matchRequirementsTxtDependency('-e git+https://github.com/x/gt-flask\n')
    ).toBeNull();
  });

  it('ignores --find-links', () => {
    expect(
      matchRequirementsTxtDependency('--find-links /path/to/gt-flask\nflask\n')
    ).toBeNull();
  });

  // ---- Partial name prevention ----

  it('does not match prefix: not-gt-flask', () => {
    expect(matchRequirementsTxtDependency('not-gt-flask>=1.0\n')).toBeNull();
  });

  it('does not match suffix: gt-flask-extra', () => {
    expect(matchRequirementsTxtDependency('gt-flask-extra>=1.0\n')).toBeNull();
  });

  it('does not match gt-flaskify', () => {
    expect(matchRequirementsTxtDependency('gt-flaskify>=1.0\n')).toBeNull();
  });

  // ---- Whitespace / formatting ----

  it('handles leading whitespace', () => {
    expect(matchRequirementsTxtDependency('  gt-flask>=1.0\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles trailing whitespace', () => {
    expect(matchRequirementsTxtDependency('gt-flask  \n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles Windows line endings', () => {
    expect(matchRequirementsTxtDependency('gt-flask>=1.0\r\n')).toBe(
      Libraries.GT_FLASK
    );
  });

  it('handles empty lines between packages', () => {
    const content = 'flask\n\n\ngt-flask\n\nrequests\n';
    expect(matchRequirementsTxtDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('returns null for empty content', () => {
    expect(matchRequirementsTxtDependency('')).toBeNull();
  });

  it('returns null for only comments', () => {
    expect(
      matchRequirementsTxtDependency('# gt-flask\n# gt-fastapi\n')
    ).toBeNull();
  });

  it('returns null for no matching packages', () => {
    expect(
      matchRequirementsTxtDependency('flask\nrequests\nuvicorn\n')
    ).toBeNull();
  });
});
