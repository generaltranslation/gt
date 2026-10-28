import {
  type GenericSchema,
  never,
  optional,
  safeParse,
  strictObject,
} from 'valibot';
import { describe, expect, it } from 'vitest';
import { createDiagnosticMessage } from '../../logging/diagnostics';
import {
  GTConfigSchema,
  describeConfigIssues,
  describeConfigParseError,
} from '../schema';

function diagnosticFor(
  config: unknown,
  schema: GenericSchema = GTConfigSchema
): string {
  const result = safeParse(schema, config);
  expect(result.success).toBe(false);
  return createDiagnosticMessage({
    source: 'generaltranslation',
    severity: 'Error',
    ...describeConfigIssues(result.issues ?? [], 'gt.config.json'),
  });
}

describe('describeConfigIssues', () => {
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

  it('keeps a custom message for a secret key', () => {
    const message = diagnosticFor(
      { apiKey: 'secret-value' },
      strictObject({ apiKey: optional(never('Remove apiKey')) })
    );

    expect(message).toContain('apiKey: Remove apiKey');
    expect(message).not.toContain('secret-value');
  });

  it('names the invalid key inside a union option', () => {
    const message = diagnosticFor({
      files: { gt: { parsingFlags: { autoderive: { jsxx: true } } } },
    });

    expect(message).toContain(
      'files.gt.parsingFlags.autoderive.jsxx: Invalid key'
    );
  });
});

describe('describeConfigParseError', () => {
  it('names the parse error without quoting the file content', () => {
    let error: unknown;
    try {
      JSON.parse('{"apiKey":SECRET_TOKEN}');
    } catch (caught) {
      error = caught;
    }
    const message = createDiagnosticMessage(
      describeConfigParseError(error, 'gt.config.json')
    );

    expect(message).toContain('gt.config.json could not be read as JSON');
    expect(message).toContain("Details: Unexpected token 'S'");
    expect(message).not.toContain('SECRET');
  });
});
