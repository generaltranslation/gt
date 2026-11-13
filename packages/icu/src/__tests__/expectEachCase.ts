const MAX_REPORTED_FAILURES = 10;

function describeCase(testCase: unknown): string {
  return JSON.stringify(testCase, (_key, value: unknown) => {
    if (typeof value === 'bigint') return `${value}n`;
    return Object.is(value, -0) ? '-0' : value;
  });
}

/**
 * Checks every entry of a generated corpus inside one test instead of
 * registering one test per entry. Every entry runs even after a failure, and
 * the thrown error names each failing input with its assertion message.
 */
export function expectEachCase<Case>(
  cases: readonly Case[],
  check: (testCase: Case) => void
): void {
  if (cases.length === 0) throw new Error('Expected a non-empty corpus');

  const failures: string[] = [];
  for (const testCase of cases) {
    try {
      check(testCase);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${describeCase(testCase)}\n  ${message}`);
    }
  }
  if (failures.length === 0) return;

  const reported = failures.slice(0, MAX_REPORTED_FAILURES);
  const omitted = failures.length - reported.length;
  throw new Error(
    `${failures.length} of ${cases.length} cases failed:\n\n` +
      reported.join('\n\n') +
      (omitted > 0 ? `\n\n...and ${omitted} more` : '')
  );
}
