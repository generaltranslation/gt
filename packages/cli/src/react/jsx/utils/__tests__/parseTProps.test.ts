import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { Metadata } from 'generaltranslation/types';
import { parseTProps } from '../jsxParsing/parseTProps.js';

describe('parseTProps requiresReview', () => {
  const FILE_PATH = 'test.tsx';

  const parseTOpeningElement = (jsx: string) => {
    const ast = parse(jsx, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    let openingElement: t.JSXOpeningElement | undefined;
    traverse(ast, {
      JSXOpeningElement(path) {
        if (
          t.isJSXIdentifier(path.node.name) &&
          path.node.name.name === 'T' &&
          !openingElement
        ) {
          openingElement = path.node;
        }
      },
    });
    if (!openingElement) throw new Error('No <T> element found');
    return openingElement;
  };

  const runParse = (jsx: string) => {
    const metadata: Metadata = {};
    const componentErrors: string[] = [];
    parseTProps({
      openingElement: parseTOpeningElement(jsx),
      metadata,
      componentErrors,
      file: FILE_PATH,
    });
    return { metadata, componentErrors };
  };

  it('treats a bare requiresReview attribute as true', () => {
    const { metadata, componentErrors } = runParse('<T requiresReview>x</T>;');
    expect(metadata.requiresReview).toBe(true);
    expect(componentErrors).toHaveLength(0);
  });

  it('treats a bare $requiresReview attribute as true', () => {
    const { metadata, componentErrors } = runParse('<T $requiresReview>x</T>;');
    expect(metadata.requiresReview).toBe(true);
    expect(componentErrors).toHaveLength(0);
  });

  it('accepts boolean literal true', () => {
    const { metadata, componentErrors } = runParse(
      '<T $requiresReview={true}>x</T>;'
    );
    expect(metadata.requiresReview).toBe(true);
    expect(componentErrors).toHaveLength(0);
  });

  it('accepts boolean literal false', () => {
    const { metadata, componentErrors } = runParse(
      '<T requiresReview={false}>x</T>;'
    );
    expect(metadata.requiresReview).toBe(false);
    expect(componentErrors).toHaveLength(0);
  });

  it('rejects string literal values', () => {
    const { metadata, componentErrors } = runParse(
      '<T requiresReview="false">x</T>;'
    );
    expect(metadata.requiresReview).toBeUndefined();
    expect(componentErrors).toHaveLength(1);
    expect(componentErrors[0]).toContain('requiresReview');
  });

  it('rejects string literal expression containers', () => {
    const { metadata, componentErrors } = runParse(
      "<T $requiresReview={'true'}>x</T>;"
    );
    expect(metadata.requiresReview).toBeUndefined();
    expect(componentErrors).toHaveLength(1);
  });

  it('rejects dynamic expressions', () => {
    const { metadata, componentErrors } = runParse(
      '<T $requiresReview={someVar}>x</T>;'
    );
    expect(metadata.requiresReview).toBeUndefined();
    expect(componentErrors).toHaveLength(1);
  });

  it('rejects negation expressions', () => {
    const { metadata, componentErrors } = runParse(
      '<T requiresReview={!!flag}>x</T>;'
    );
    expect(metadata.requiresReview).toBeUndefined();
    expect(componentErrors).toHaveLength(1);
  });

  it('does not affect other attributes', () => {
    const { metadata, componentErrors } = runParse(
      '<T id="greeting" $requiresReview={true} $context={"header"}>x</T>;'
    );
    expect(metadata).toMatchObject({
      id: 'greeting',
      requiresReview: true,
      context: 'header',
    });
    expect(componentErrors).toHaveLength(0);
  });
});
