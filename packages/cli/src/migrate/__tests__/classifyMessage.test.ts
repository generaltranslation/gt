import { describe, expect, it } from 'vitest';
import { classifyMessage } from '../classifyMessage.js';

describe('classifyMessage', () => {
  it('classifies plain text', () => {
    expect(classifyMessage('Hello world')).toEqual({
      kind: 'text',
      argNames: [],
    });
  });

  it('classifies simple arguments', () => {
    expect(classifyMessage('Hello, {name}!')).toEqual({
      kind: 'args',
      argNames: ['name'],
    });
  });

  it('collects multiple argument names in order', () => {
    expect(classifyMessage('{greeting}, {name}!')).toEqual({
      kind: 'args',
      argNames: ['greeting', 'name'],
    });
  });

  it('classifies number/date/time formats as args', () => {
    expect(classifyMessage('Total: {amount, number, ::currency/USD}')).toEqual({
      kind: 'args',
      argNames: ['amount'],
    });
    expect(classifyMessage('Due {when, date, medium}')).toEqual({
      kind: 'args',
      argNames: ['when'],
    });
  });

  it('classifies plural as branching', () => {
    const result = classifyMessage(
      '{count, plural, =0 {no items} one {one item} other {{count} items}}'
    );
    expect(result.kind).toBe('branching');
    expect(result.argNames).toContain('count');
  });

  it('classifies select as branching', () => {
    const result = classifyMessage(
      '{gender, select, female {her} male {his} other {their}}'
    );
    expect(result.kind).toBe('branching');
  });

  it('classifies branching nested inside tags as branching', () => {
    const result = classifyMessage(
      '<b>{count, plural, one {# item} other {# items}}</b>'
    );
    expect(result.kind).toBe('branching');
  });

  it('classifies rich tags as tags', () => {
    expect(classifyMessage('Hi <b>friend</b>')).toEqual({
      kind: 'tags',
      argNames: [],
    });
  });

  it('classifies tags with arguments as tags and keeps argNames', () => {
    const result = classifyMessage('Hello <b>{name}</b>!');
    expect(result.kind).toBe('tags');
    expect(result.argNames).toEqual(['name']);
  });

  it('classifies malformed ICU as invalid', () => {
    expect(classifyMessage('Hello {').kind).toBe('invalid');
  });

  it("handles escaped quotes: It''s {n}", () => {
    expect(classifyMessage("It''s {n}")).toEqual({
      kind: 'args',
      argNames: ['n'],
    });
  });

  it("treats ICU-escaped braces '{' as text", () => {
    expect(classifyMessage("literal '{' brace").kind).toBe('text');
  });
});
