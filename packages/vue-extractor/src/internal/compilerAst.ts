/**
 * Vue compiler node discriminants used by the extractor.
 *
 * These values are defined locally so the production bundle can inspect the
 * compiler-sfc AST without importing a second runtime copy of compiler-dom.
 * The matching test intentionally compares them with the installed compiler.
 */
export const NodeTypes = {
  ELEMENT: 1,
  TEXT: 2,
  COMMENT: 3,
  SIMPLE_EXPRESSION: 4,
  INTERPOLATION: 5,
  ATTRIBUTE: 6,
  DIRECTIVE: 7,
} as const;

/** Vue element discriminants used by the extractor. */
export const ElementTypes = {
  COMPONENT: 1,
  SLOT: 2,
} as const;
