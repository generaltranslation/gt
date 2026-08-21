import { describe, it, expect } from 'vitest';
import { compareIcuMessages, type IcuIssue } from '../compareMessages.js';

function kinds(issues: IcuIssue[]): string[] {
  return issues.map((i) => i.kind).sort();
}

describe('compareIcuMessages', () => {
  it('returns no issues for a faithful translation', () => {
    expect(compareIcuMessages('Hello {name}', 'Cześć {name}')).toEqual([]);
  });

  it('returns no issues for identical plain text', () => {
    expect(compareIcuMessages('Save', 'Zapisz')).toEqual([]);
  });

  it('flags a translation that does not parse as ICU', () => {
    const issues = compareIcuMessages('Hello {name}', 'Hej {name');
    expect(kinds(issues)).toEqual(['parse-error']);
    expect(issues[0].message).toBeTruthy();
  });

  it('flags a plural translation missing the other clause as a parse error', () => {
    const issues = compareIcuMessages(
      '{n, plural, one {# item} other {# items}}',
      '{n, plural, one {# plik}}'
    );
    expect(kinds(issues)).toEqual(['parse-error']);
  });

  it('flags arguments invented by the translation', () => {
    const issues = compareIcuMessages('Hello {name}', 'Hei {nam}');
    expect(kinds(issues)).toEqual(['extra-argument', 'missing-argument']);
    const extra = issues.find((i) => i.kind === 'extra-argument');
    expect(extra?.argument).toBe('nam');
    const missing = issues.find((i) => i.kind === 'missing-argument');
    expect(missing?.argument).toBe('name');
  });

  it('allows locale-specific plural categories', () => {
    const issues = compareIcuMessages(
      '{n, plural, one {# item} other {# items}}',
      '{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}'
    );
    expect(issues).toEqual([]);
  });

  it('flags a plural argument downgraded to a plain argument', () => {
    const issues = compareIcuMessages(
      '{n, plural, one {# item} other {# items}}',
      '{n} items'
    );
    expect(kinds(issues)).toEqual(['argument-type-mismatch']);
    expect(issues[0].argument).toBe('n');
  });

  it('sees arguments nested inside plural options', () => {
    const issues = compareIcuMessages(
      '{n, plural, one {{name} has # item} other {{name} has # items}}',
      '{n, plural, other {# elementów}}'
    );
    expect(kinds(issues)).toEqual(['missing-argument']);
    expect(issues[0].argument).toBe('name');
  });

  it('sees arguments nested inside select options', () => {
    const issues = compareIcuMessages(
      '{gender, select, female {She invited {guest}} other {They invited {guest}}}',
      '{gender, select, other {Zaprosili}}'
    );
    expect(kinds(issues)).toEqual(['missing-argument']);
    expect(issues[0].argument).toBe('guest');
  });

  it('flags number/date argument type mismatches', () => {
    const issues = compareIcuMessages('{when, date}', '{when, number}');
    expect(kinds(issues)).toEqual(['argument-type-mismatch']);
  });

  it('treats rich-text tags as arguments', () => {
    expect(compareIcuMessages('click <b>here</b>', 'klik <b>hier</b>')).toEqual(
      []
    );
    const issues = compareIcuMessages('click <b>here</b>', 'klik hier');
    expect(kinds(issues)).toEqual(['missing-argument']);
    expect(issues[0].argument).toBe('b');
  });

  it('distinguishes cardinal from ordinal plurals', () => {
    const issues = compareIcuMessages(
      '{n, selectordinal, one {#st} other {#th}}',
      '{n, plural, other {#}}'
    );
    expect(kinds(issues)).toEqual(['argument-type-mismatch']);
  });

  it('keeps tags and arguments with the same name distinct', () => {
    const issues = compareIcuMessages('{b} and <b>x</b>', '{b} only');
    expect(kinds(issues)).toEqual(['missing-argument']);
    expect(issues[0].argument).toBe('b');
    expect(issues[0].message).toContain('<b>');
  });

  it('flags a tag replaced by a plain argument as both missing and extra', () => {
    const issues = compareIcuMessages('click <b>here</b>', 'klik {b}');
    expect(kinds(issues)).toEqual(['extra-argument', 'missing-argument']);
  });

  it('hints about quoting when a translation trips tag parsing', () => {
    const issues = compareIcuMessages('a is less than b', 'wenn a<b ist');
    expect(kinds(issues)).toEqual(['parse-error']);
    expect(issues[0].message).toContain("'<'");
  });

  it('skips sources that are not valid ICU themselves', () => {
    expect(compareIcuMessages('hello {{name}}', 'anything {broken')).toEqual(
      []
    );
  });

  it('accepts a translation reusing an argument multiple times', () => {
    expect(compareIcuMessages('Hi {name}', '{name}, witaj {name}!')).toEqual(
      []
    );
  });

  it('reports each argument problem once', () => {
    const issues = compareIcuMessages('Hello {name}', 'Hej {nam} {nam}');
    expect(kinds(issues)).toEqual(['extra-argument', 'missing-argument']);
  });
});
