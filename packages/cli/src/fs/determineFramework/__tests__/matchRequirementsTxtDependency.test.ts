import { describe, expect, it } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import { matchRequirementsTxtDependency } from '../matchRequirementsTxtDependency.js';

describe('matchRequirementsTxtDependency', () => {
  it.each([
    ['a plain requirement', 'gt-flask\n'],
    [
      'a requirement among other packages',
      'flask\nuvicorn\ngt-flask\nrequests\n',
    ],
    // Version specifiers
    ['a >= specifier', 'gt-flask>=1.0.0\n'],
    ['an == specifier', 'gt-flask==1.2.3\n'],
    ['a ~= specifier', 'gt-flask~=1.0\n'],
    ['a != specifier', 'gt-flask!=1.0.0\n'],
    ['< and > specifiers', 'gt-flask>1.0,<2.0\n'],
    // PEP 503 name normalization
    ['the underscore spelling', 'gt_flask\n'],
    ['mixed case', 'GT-Flask\n'],
    ['the period spelling', 'gt.flask\n'],
    // Extras, markers and URLs
    ['one extra', 'gt-flask[redis]>=1.0\n'],
    ['several extras', 'gt-flask[redis,celery]>=1.0\n'],
    ['an environment marker', 'gt-flask>=1.0; python_version >= "3.8"\n'],
    ['an @ URL', 'gt-flask @ https://example.com/gt-flask-1.0.tar.gz\n'],
    ['a trailing comment', 'gt-flask>=1.0 # i18n support\n'],
    // Whitespace
    ['leading whitespace', '  gt-flask>=1.0\n'],
    ['trailing whitespace', 'gt-flask  \n'],
    ['Windows line endings', 'gt-flask>=1.0\r\n'],
    ['empty lines between packages', 'flask\n\n\ngt-flask\n\nrequests\n'],
  ])('detects gt-flask with %s', (_case, content) => {
    expect(matchRequirementsTxtDependency(content)).toBe(Libraries.GT_FLASK);
  });

  it('detects gt-fastapi', () => {
    expect(matchRequirementsTxtDependency('gt-fastapi\n')).toBe(
      Libraries.GT_FASTAPI
    );
  });

  it.each([
    ['empty content', ''],
    ['no matching packages', 'flask\nrequests\nuvicorn\n'],
    // Comments
    ['only comments', '# gt-flask\n# gt-fastapi\n'],
    ['a full-line comment naming it', '# gt-flask is not installed\nflask\n'],
    ['a comment after another package', 'flask # replaces gt-flask\n'],
    // Pip directives
    ['an -r include', '-r other-requirements.txt\nflask\n'],
    ['an --index-url', '--index-url https://pypi.org/simple\nflask\n'],
    ['an -e editable install', '-e git+https://github.com/x/gt-flask\n'],
    ['a --find-links path', '--find-links /path/to/gt-flask\nflask\n'],
    // Partial names
    ['a longer name ending in it', 'not-gt-flask>=1.0\n'],
    ['a longer name starting with it', 'gt-flask-extra>=1.0\n'],
    ['a name it is a prefix of', 'gt-flaskify>=1.0\n'],
  ])('returns null for %s', (_case, content) => {
    expect(matchRequirementsTxtDependency(content)).toBeNull();
  });
});
