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

type CompilerPosition = {
  column: number;
  line: number;
  offset: number;
};

type CompilerLocation = {
  end?: Partial<CompilerPosition>;
  source?: string;
  start?: Partial<CompilerPosition>;
};

/**
 * Rebases a compiler AST from template-content coordinates to its full SFC.
 *
 * The input is intentionally `unknown`: Vue compiler AST types are not part
 * of the extractor's public declaration graph and differ across supported
 * Vue releases. Runtime structural guards preserve safety at this internal
 * boundary without making consumers install the extractor's test compiler.
 */
export function shiftCompilerAstLocations(
  ast: unknown,
  origin: CompilerPosition
): void {
  const seen = new WeakSet<object>();
  const shiftedPositions = new WeakSet<object>();

  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (isCompilerLocation(value)) {
      shiftCompilerLocation(value, origin, shiftedPositions);
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    for (const child of Object.values(value)) visit(child);
  };

  visit(ast);
}

/** Rebases one structurally validated Vue compiler source range. */
export function shiftCompilerLocation(
  location: CompilerLocation,
  origin: CompilerPosition,
  shiftedPositions = new WeakSet<object>()
): void {
  if (location.start) {
    shiftCompilerPosition(location.start, origin, shiftedPositions);
  }
  if (location.end) {
    shiftCompilerPosition(location.end, origin, shiftedPositions);
  }
}

/** Rebases a template-relative position to the containing SFC. */
function shiftCompilerPosition(
  position: Partial<CompilerPosition>,
  origin: CompilerPosition,
  shiftedPositions: WeakSet<object>
): void {
  if (shiftedPositions.has(position)) return;
  shiftedPositions.add(position);
  const line = position.line ?? 1;
  const column = position.column ?? 1;
  const offset = position.offset ?? 0;
  position.line = origin.line + line - 1;
  position.column = line === 1 ? origin.column + column - 1 : column;
  position.offset = origin.offset + offset;
}

/** Identifies Vue compiler source locations while skipping Babel AST ranges. */
function isCompilerLocation(value: object): value is CompilerLocation {
  if (!('start' in value) || !('end' in value) || !('source' in value)) {
    return false;
  }
  return isCompilerPosition(value.start) && isCompilerPosition(value.end);
}

/** Returns whether a value has Vue compiler line, column, and offset fields. */
function isCompilerPosition(value: unknown): value is CompilerPosition {
  return (
    !!value &&
    typeof value === 'object' &&
    'line' in value &&
    typeof value.line === 'number' &&
    'column' in value &&
    typeof value.column === 'number' &&
    'offset' in value &&
    typeof value.offset === 'number'
  );
}
