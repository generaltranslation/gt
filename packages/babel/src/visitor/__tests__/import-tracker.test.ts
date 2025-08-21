import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { ImportTracker } from '../import-tracker';

describe('ImportTracker', () => {
  let importTracker: ImportTracker;

  beforeEach(() => {
    importTracker = new ImportTracker();
  });

  describe('scope delegation', () => {
    it('should delegate to scope tracker for enter/exit scope', () => {
      const scope1 = importTracker.enterScope();
      const scope2 = importTracker.enterScope();
      
      expect(scope1).toBe(1);
      expect(scope2).toBe(2);

      importTracker.exitScope();
      importTracker.exitScope();
    });
  });

  describe('namespace imports', () => {
    it('should track namespace imports', () => {
      // Create a mock import declaration: import * as GT from 'gt-next'
      const importDecl = t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier('GT'))],
        t.stringLiteral('gt-next')
      );

      const mockPath = {
        node: importDecl
      } as any;

      importTracker.processGTImportDeclaration(mockPath);

      expect(importTracker.namespaceImports.has('GT')).toBe(true);
    });

    it('should track multiple namespace imports', () => {
      // Create multiple namespace imports
      const importDecl1 = t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier('GT'))],
        t.stringLiteral('gt-next')
      );

      const importDecl2 = t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier('Translation'))],
        t.stringLiteral('gt-next/client')
      );

      importTracker.processGTImportDeclaration({ node: importDecl1 } as any);
      importTracker.processGTImportDeclaration({ node: importDecl2 } as any);

      expect(importTracker.namespaceImports.has('GT')).toBe(true);
      expect(importTracker.namespaceImports.has('Translation')).toBe(true);
    });
  });

  describe('named imports', () => {
    it('should track named imports for translation components', () => {
      importTracker.enterScope();

      // Create named import: import { T } from 'gt-next'
      const importDecl = t.importDeclaration(
        [t.importSpecifier(t.identifier('T'), t.identifier('T'))],
        t.stringLiteral('gt-next')
      );

      importTracker.processGTImportDeclaration({ node: importDecl } as any);

      expect(importTracker.shouldTrackComponentAsTranslation('T')).toBe(true);
      expect(importTracker.shouldTrackComponentAsVariable('T')).toBe(false);
      expect(importTracker.shouldTrackComponentAsBranch('T')).toBe(false);
    });

    it('should track named imports for variable components', () => {
      importTracker.enterScope();

      // Create named imports: import { Var, Num, Currency, DateTime } from 'gt-next'
      const importDecl = t.importDeclaration([
        t.importSpecifier(t.identifier('Var'), t.identifier('Var')),
        t.importSpecifier(t.identifier('Num'), t.identifier('Num')),
        t.importSpecifier(t.identifier('Currency'), t.identifier('Currency')),
        t.importSpecifier(t.identifier('DateTime'), t.identifier('DateTime'))
      ], t.stringLiteral('gt-next'));

      importTracker.processGTImportDeclaration({ node: importDecl } as any);

      expect(importTracker.shouldTrackComponentAsVariable('Var')).toBe(true);
      expect(importTracker.shouldTrackComponentAsVariable('Num')).toBe(true);
      expect(importTracker.shouldTrackComponentAsVariable('Currency')).toBe(true);
      expect(importTracker.shouldTrackComponentAsVariable('DateTime')).toBe(true);

      // Should not be translation or branch components
      expect(importTracker.shouldTrackComponentAsTranslation('Var')).toBe(false);
      expect(importTracker.shouldTrackComponentAsBranch('Var')).toBe(false);
    });

    it('should track named imports for branch components', () => {
      importTracker.enterScope();

      // Create named imports: import { Branch, Plural } from 'gt-next'
      const importDecl = t.importDeclaration([
        t.importSpecifier(t.identifier('Branch'), t.identifier('Branch')),
        t.importSpecifier(t.identifier('Plural'), t.identifier('Plural'))
      ], t.stringLiteral('gt-next'));

      importTracker.processGTImportDeclaration({ node: importDecl } as any);

      expect(importTracker.shouldTrackComponentAsBranch('Branch')).toBe(true);
      expect(importTracker.shouldTrackComponentAsBranch('Plural')).toBe(true);

      // Should not be translation or variable components
      expect(importTracker.shouldTrackComponentAsTranslation('Branch')).toBe(false);
      expect(importTracker.shouldTrackComponentAsVariable('Branch')).toBe(false);
    });

    it('should track named imports for translation functions', () => {
      importTracker.enterScope();

      // Create named imports: import { useGT, getGT } from 'gt-next'
      const importDecl = t.importDeclaration([
        t.importSpecifier(t.identifier('useGT'), t.identifier('useGT')),
        t.importSpecifier(t.identifier('getGT'), t.identifier('getGT'))
      ], t.stringLiteral('gt-next'));

      importTracker.processGTImportDeclaration({ node: importDecl } as any);

      const useGTVar = importTracker.scopeTracker.getTranslationVariable('useGT');
      const getGTVar = importTracker.scopeTracker.getTranslationVariable('getGT');

      expect(useGTVar).toBeDefined();
      expect(useGTVar!.originalName).toBe('useGT');
      expect(getGTVar).toBeDefined();
      expect(getGTVar!.originalName).toBe('getGT');
    });

    it('should handle aliased imports', () => {
      importTracker.enterScope();

      // Create aliased import: import { T as Translation } from 'gt-next'
      const importDecl = t.importDeclaration(
        [t.importSpecifier(t.identifier('Translation'), t.identifier('T'))],
        t.stringLiteral('gt-next')
      );

      importTracker.processGTImportDeclaration({ node: importDecl } as any);

      expect(importTracker.shouldTrackComponentAsTranslation('Translation')).toBe(true);
      expect(importTracker.shouldTrackComponentAsTranslation('T')).toBe(false);
    });
  });

  describe('GT import source filtering', () => {
    it('should only process GT imports', () => {
      importTracker.enterScope();

      // Create non-GT import
      const nonGTImport = t.importDeclaration(
        [t.importSpecifier(t.identifier('Component'), t.identifier('Component'))],
        t.stringLiteral('react')
      );

      importTracker.processGTImportDeclaration({ node: nonGTImport } as any);

      expect(importTracker.shouldTrackComponentAsTranslation('Component')).toBe(false);
      expect(importTracker.namespaceImports.size).toBe(0);
    });

    it('should process all GT import sources', () => {
      const gtSources = ['gt-next', 'gt-next/client', 'gt-next/server'];

      gtSources.forEach(source => {
        const importDecl = t.importDeclaration(
          [t.importSpecifier(t.identifier('T'), t.identifier('T'))],
          t.stringLiteral(source)
        );

        const tracker = new ImportTracker();
        tracker.enterScope();
        tracker.processGTImportDeclaration({ node: importDecl } as any);

        expect(tracker.shouldTrackComponentAsTranslation('T')).toBe(true);
      });
    });
  });

  describe('namespace component checking', () => {
    it('should identify namespace components correctly', () => {
      // Add GT as namespace import
      importTracker.namespaceImports.add('GT');

      const [isTranslation, isVariable, isBranch] = importTracker.shouldTrackNamespaceComponent('GT', 'T');
      expect(isTranslation).toBe(true);
      expect(isVariable).toBe(false);
      expect(isBranch).toBe(false);

      const [isTranslation2, isVariable2, isBranch2] = importTracker.shouldTrackNamespaceComponent('GT', 'Var');
      expect(isTranslation2).toBe(false);
      expect(isVariable2).toBe(true);
      expect(isBranch2).toBe(false);

      const [isTranslation3, isVariable3, isBranch3] = importTracker.shouldTrackNamespaceComponent('GT', 'Branch');
      expect(isTranslation3).toBe(false);
      expect(isVariable3).toBe(false);
      expect(isBranch3).toBe(true);
    });

    it('should return false for non-namespace objects', () => {
      const [isTranslation, isVariable, isBranch] = importTracker.shouldTrackNamespaceComponent('React', 'Component');
      expect(isTranslation).toBe(false);
      expect(isVariable).toBe(false);
      expect(isBranch).toBe(false);
    });

    it('should return false for unknown components in namespace', () => {
      importTracker.namespaceImports.add('GT');

      const [isTranslation, isVariable, isBranch] = importTracker.shouldTrackNamespaceComponent('GT', 'UnknownComponent');
      expect(isTranslation).toBe(false);
      expect(isVariable).toBe(false);
      expect(isBranch).toBe(false);
    });
  });

  describe('mixed import styles', () => {
    it('should handle mixed named and namespace imports', () => {
      importTracker.enterScope();

      // Named import
      const namedImport = t.importDeclaration(
        [t.importSpecifier(t.identifier('T'), t.identifier('T'))],
        t.stringLiteral('gt-next')
      );

      // Namespace import
      const namespaceImport = t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier('GT'))],
        t.stringLiteral('gt-next')
      );

      importTracker.processGTImportDeclaration({ node: namedImport } as any);
      importTracker.processGTImportDeclaration({ node: namespaceImport } as any);

      // Should work with both styles
      expect(importTracker.shouldTrackComponentAsTranslation('T')).toBe(true);
      expect(importTracker.namespaceImports.has('GT')).toBe(true);

      const [isTranslation, , ] = importTracker.shouldTrackNamespaceComponent('GT', 'T');
      expect(isTranslation).toBe(true);
    });

    it('should handle multiple imports from different GT packages', () => {
      importTracker.enterScope();

      const clientImport = t.importDeclaration(
        [t.importSpecifier(t.identifier('T'), t.identifier('T'))],
        t.stringLiteral('gt-next/client')
      );

      const serverImport = t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier('GT'))],
        t.stringLiteral('gt-next/server')
      );

      importTracker.processGTImportDeclaration({ node: clientImport } as any);
      importTracker.processGTImportDeclaration({ node: serverImport } as any);

      expect(importTracker.shouldTrackComponentAsTranslation('T')).toBe(true);
      expect(importTracker.namespaceImports.has('GT')).toBe(true);
    });
  });

  describe('scope integration', () => {
    it('should respect scope boundaries for variable tracking', () => {
      const scope1 = importTracker.enterScope();

      // Import in first scope
      const importDecl = t.importDeclaration(
        [t.importSpecifier(t.identifier('useGT'), t.identifier('useGT'))],
        t.stringLiteral('gt-next')
      );

      importTracker.processGTImportDeclaration({ node: importDecl } as any);

      // Should be accessible in same scope
      expect(importTracker.scopeTracker.getTranslationVariable('useGT')).toBeDefined();

      // Enter nested scope
      importTracker.enterScope();
      expect(importTracker.scopeTracker.getTranslationVariable('useGT')).toBeDefined();

      // Exit nested scope
      importTracker.exitScope();
      expect(importTracker.scopeTracker.getTranslationVariable('useGT')).toBeDefined();

      // Exit original scope
      importTracker.exitScope();
      expect(importTracker.scopeTracker.getTranslationVariable('useGT')).toBeUndefined();
    });
  });
});