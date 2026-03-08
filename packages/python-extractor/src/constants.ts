export const PYTHON_GT_PACKAGES = ['gt_flask', 'gt_fastapi'] as const;
export const PYTHON_GT_DEPENDENCIES = ['gt-flask', 'gt-fastapi'] as const;
export const PYTHON_T_FUNCTION = 't';
export const PYTHON_MSG_FUNCTION = 'msg';
/** Only these imported names are tracked as translation functions */
export const PYTHON_TRANSLATION_FUNCTIONS = ['t', 'msg'] as const;
export const PYTHON_METADATA_KWARGS = {
  _id: 'id',
  _context: 'context',
  _max_chars: 'maxChars',
} as const;
