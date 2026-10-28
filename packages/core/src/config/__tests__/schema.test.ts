import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';
import { GTConfigSchema, createConfigIssuesDiagnostic } from '../schema';

function diagnosticFor(config: unknown): string {
  const result = safeParse(GTConfigSchema, config);
  expect(result.success).toBe(false);
  return createConfigIssuesDiagnostic(result.issues ?? [], {
    source: 'generaltranslation',
    severity: 'Error',
  });
}

describe('createConfigIssuesDiagnostic', () => {
  it('lists each invalid key with the received value', () => {
    const message = diagnosticFor({ locales: 'fr', localeMatcher: 'exact' });

    expect(message).toContain(
      'generaltranslation Error: gt.config.json is invalid'
    );
    expect(message).toContain(
      'locales: Invalid type: Expected Array but received "fr"'
    );
    expect(message).toContain(
      'localeMatcher: Invalid type: Expected ("lookup" | "best fit") but received "exact"'
    );
  });

  it('never echoes the value of a secret key', () => {
    const message = diagnosticFor({ apiKey: 4242424242 });

    expect(message).toContain('apiKey: expected string');
    expect(message).not.toContain('4242424242');
  });
});
