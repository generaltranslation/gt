export const PYTHON_GT_PACKAGES = ['gt_flask', 'gt_fastapi'] as const;
export const PYTHON_GT_DEPENDENCIES = ['gt-flask', 'gt-fastapi'] as const;
export const PYTHON_T_FUNCTION = 't';
export const PYTHON_MSG_FUNCTION = 'msg';
export const PYTHON_DECLARE_STATIC = 'declare_static';
export const PYTHON_DECLARE_VAR = 'declare_var';
/** These imported names are tracked (translation functions + static helpers) */
export const PYTHON_TRANSLATION_FUNCTIONS = [
  't',
  'msg',
  'declare_static',
  'declare_var',
] as const;
export const PYTHON_METADATA_KWARGS = {
  _id: 'id',
  _context: 'context',
  _max_chars: 'maxChars',
} as const;
