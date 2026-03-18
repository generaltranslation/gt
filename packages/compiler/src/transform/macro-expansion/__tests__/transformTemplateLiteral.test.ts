import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { transformTemplateLiteral } from '../transformTemplateLiteral';

describe('transformTemplateLiteral', () => {
  it('handles no interpolations', () => {
    const node = t.templateLiteral(
      [t.templateElement({ raw: 'Hello world', cooked: 'Hello world' }, true)],
      []
    );
    const { message, variables } = transformTemplateLiteral(node);
    expect(message.value).toBe('Hello world');
    expect(variables).toBeNull();
  });

  it('handles a single variable', () => {
    const node = t.templateLiteral(
      [
        t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }, false),
        t.templateElement({ raw: '', cooked: '' }, true),
      ],
      [t.identifier('name')]
    );
    const { message, variables } = transformTemplateLiteral(node);
    expect(message.value).toBe('Hello, {0}');
    expect(variables).not.toBeNull();
    expect(variables!.properties).toHaveLength(1);
    const prop = variables!.properties[0] as t.ObjectProperty;
    expect((prop.key as t.StringLiteral).value).toBe('0');
    expect((prop.value as t.Identifier).name).toBe('name');
  });

  it('handles multiple variables with correct indices', () => {
    const node = t.templateLiteral(
      [
        t.templateElement({ raw: '', cooked: '' }, false),
        t.templateElement({ raw: ', ', cooked: ', ' }, false),
        t.templateElement({ raw: '!', cooked: '!' }, true),
      ],
      [t.identifier('greeting'), t.identifier('name')]
    );
    const { message, variables } = transformTemplateLiteral(node);
    expect(message.value).toBe('{0}, {1}!');
    expect(variables!.properties).toHaveLength(2);
    const prop0 = variables!.properties[0] as t.ObjectProperty;
    const prop1 = variables!.properties[1] as t.ObjectProperty;
    expect((prop0.key as t.StringLiteral).value).toBe('0');
    expect((prop1.key as t.StringLiteral).value).toBe('1');
  });

  it('handles MemberExpression', () => {
    const node = t.templateLiteral(
      [
        t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }, false),
        t.templateElement({ raw: '', cooked: '' }, true),
      ],
      [t.memberExpression(t.identifier('user'), t.identifier('name'))]
    );
    const { message } = transformTemplateLiteral(node);
    expect(message.value).toBe('Hello, {0}');
  });

  it('handles complex expression', () => {
    const node = t.templateLiteral(
      [
        t.templateElement({ raw: 'Result: ', cooked: 'Result: ' }, false),
        t.templateElement({ raw: '', cooked: '' }, true),
      ],
      [t.binaryExpression('+', t.identifier('a'), t.identifier('b'))]
    );
    const { message } = transformTemplateLiteral(node);
    expect(message.value).toBe('Result: {0}');
  });

  it('handles empty template', () => {
    const node = t.templateLiteral(
      [t.templateElement({ raw: '', cooked: '' }, true)],
      []
    );
    const { message, variables } = transformTemplateLiteral(node);
    expect(message.value).toBe('');
    expect(variables).toBeNull();
  });

  it('handles adjacent expressions with no text between them', () => {
    const node = t.templateLiteral(
      [
        t.templateElement({ raw: '', cooked: '' }, false),
        t.templateElement({ raw: '', cooked: '' }, false),
        t.templateElement({ raw: '', cooked: '' }, true),
      ],
      [t.identifier('a'), t.identifier('b')]
    );
    const { message } = transformTemplateLiteral(node);
    expect(message.value).toBe('{0}{1}');
  });
});
