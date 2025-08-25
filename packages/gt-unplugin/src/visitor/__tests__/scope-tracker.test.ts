import { describe, it, expect, beforeEach } from 'vitest';
import { ScopeTracker } from '../scope-tracker';

describe('ScopeTracker', () => {
  let tracker: ScopeTracker;

  beforeEach(() => {
    tracker = new ScopeTracker();
  });

  describe('basic scope creation', () => {
    it('should create scopes with incrementing IDs', () => {
      // Enter first scope
      const scope1 = tracker.enterScope();
      expect(scope1).toBe(1);

      // Enter nested scope
      const scope2 = tracker.enterScope();
      expect(scope2).toBe(2);

      // Check scope info
      const info1 = tracker.getScopeInfo(1);
      expect(info1).toBeDefined();
      expect(info1!.id).toBe(1);
      expect(info1!.parentId).toBe(0); // 0 means no parent
      expect(info1!.depth).toBe(0);

      const info2 = tracker.getScopeInfo(2);
      expect(info2).toBeDefined();
      expect(info2!.id).toBe(2);
      expect(info2!.parentId).toBe(1); // parent is scope 1
      expect(info2!.depth).toBe(2); // depth calculation includes stack length + 1
    });
  });

  describe('scope exit behavior', () => {
    it('should clean up scope info on exit', () => {
      // Enter first scope
      const scope1 = tracker.enterScope();
      expect(scope1).toBe(1);

      // Enter nested scope
      const scope2 = tracker.enterScope();
      expect(scope2).toBe(2);

      // Exit nested scope - scope info should be removed
      tracker.exitScope();
      expect(tracker.getScopeInfo(scope2)).toBeUndefined(); // scope2 should be cleaned up
      expect(tracker.getScopeInfo(scope1)).toBeDefined(); // scope1 should still exist

      // Exit first scope - should be cleaned up too
      tracker.exitScope();
      expect(tracker.getScopeInfo(scope1)).toBeUndefined(); // scope1 should be cleaned up
    });
  });

  describe('variable scoping', () => {
    it('should handle variable accessibility across scopes', () => {
      // Enter first scope and track a variable
      const scope1 = tracker.enterScope();
      tracker.trackTranslationVariable('t', 'useGT', 0);

      // Variable should be accessible in same scope
      const variable = tracker.getVariable('t');
      expect(variable).toBeDefined();
      expect(variable!.scopeId).toBe(scope1);
      expect(variable!.originalName).toBe('useGT');
      expect(variable!.isTranslationFunction).toBe(true);

      // Enter nested scope
      tracker.enterScope();

      // Variable should still be accessible in nested scope (inheritance)
      expect(tracker.getVariable('t')).toBeDefined();

      // Exit nested scope
      tracker.exitScope();

      // Variable should still be accessible in original scope
      expect(tracker.getVariable('t')).toBeDefined();

      // Exit first scope
      tracker.exitScope();

      // Variable should no longer be accessible (out of scope)
      expect(tracker.getVariable('t')).toBeUndefined();
    });
  });

  describe('variable shadowing', () => {
    it('should handle variable shadowing correctly', () => {
      // Enter outer scope
      tracker.enterScope();
      tracker.trackTranslationVariable('t', 'useGT', 0);

      // Verify outer variable
      const outerVar = tracker.getVariable('t')!;
      expect(outerVar.originalName).toBe('useGT');

      // Enter inner scope and shadow the variable
      const scope2 = tracker.enterScope();
      tracker.trackTranslationVariable('t', 'getGT', 1);

      // Should get the shadowed (inner) variable
      const innerVar = tracker.getVariable('t')!;
      expect(innerVar.originalName).toBe('getGT');
      expect(innerVar.scopeId).toBe(scope2);

      // Exit inner scope (this should remove the inner variable)
      tracker.exitScope();

      // Should get the outer variable again
      const restoredVar = tracker.getVariable('t')!;
      expect(restoredVar.originalName).toBe('useGT');
    });
  });

  describe('sibling scope isolation', () => {
    it('should isolate variables between sibling scopes', () => {
      // Enter parent scope
      tracker.enterScope();

      // Enter first child scope and track variable
      tracker.enterScope();
      tracker.trackTranslationVariable('t1', 'useGT', 0);
      tracker.exitScope(); // Exit first child - t1 should be removed

      // Enter second child scope
      tracker.enterScope();
      tracker.trackTranslationVariable('t2', 'getGT', 1);

      // Should not be able to access sibling's variable (was cleaned up on exit)
      expect(tracker.getVariable('t1')).toBeUndefined();
      // Should be able to access own variable
      expect(tracker.getVariable('t2')).toBeDefined();
    });
  });

  describe('deterministic scope IDs', () => {
    it('should produce same scope IDs for same sequence', () => {
      const tracker2 = new ScopeTracker();

      // Same sequence of operations should produce same scope IDs
      const scope1A = tracker.enterScope();
      const scope1B = tracker2.enterScope();
      expect(scope1A).toBe(scope1B);

      const scope2A = tracker.enterScope();
      const scope2B = tracker2.enterScope();
      expect(scope2A).toBe(scope2B);

      tracker.exitScope();
      tracker2.exitScope();

      const scope3A = tracker.enterScope();
      const scope3B = tracker2.enterScope();
      expect(scope3A).toBe(scope3B);
    });
  });

  describe('helper methods', () => {
    it('should provide convenient access methods', () => {
      tracker.enterScope();
      tracker.trackTranslationVariable('myTranslator', 'useGT', 0);
      tracker.trackRegularVariable('regularVar', 'someValue');

      // Test translation function helper
      const translationFunc = tracker.getTranslationVariable('myTranslator');
      expect(translationFunc).toBeDefined();
      expect(translationFunc!.originalName).toBe('useGT');

      // Test general variable value helper
      const varValue = tracker.getVariable('regularVar');
      expect(varValue).toBeDefined();
      expect(varValue!.originalName).toBe('someValue');

      // Test that regular variable doesn't return from translation helper
      const notTranslation = tracker.getTranslationVariable('regularVar');
      expect(notTranslation).toBeUndefined();

      // Test non-existent variable
      const missing = tracker.getVariable('nonexistent');
      expect(missing).toBeUndefined();
    });
  });

  describe('all variable types tracking', () => {
    it('should track different types of variables correctly', () => {
      const scope1 = tracker.enterScope();

      // Track different types of variables
      tracker.trackTranslationVariable('t1', 'useGT', 0);
      tracker.trackRegularVariable('literal', 'string_literal');
      tracker.trackRegularVariable('reference', 'ref:t1');
      tracker.trackRegularVariable('undefinedVar', 'undefined');

      // All should be accessible in same scope
      expect(tracker.getVariable('t1')).toBeDefined();
      expect(tracker.getVariable('literal')).toBeDefined();
      expect(tracker.getVariable('reference')).toBeDefined();
      expect(tracker.getVariable('undefinedVar')).toBeDefined();

      // Check types are preserved
      const t1Var = tracker.getVariable('t1')!;
      expect(t1Var.isTranslationFunction).toBe(true);
      expect(t1Var.originalName).toBe('useGT');

      const literalVar = tracker.getVariable('literal')!;
      expect(literalVar.isTranslationFunction).toBe(false);
      expect(literalVar.originalName).toBe('string_literal');

      // Enter nested scope
      tracker.enterScope();

      // All parent variables should be accessible
      expect(tracker.getVariable('t1')).toBeDefined();
      expect(tracker.getVariable('literal')).toBeDefined();

      // Shadow a variable
      tracker.trackRegularVariable('t1', 'not_a_function');

      // Should get shadowed version
      const shadowed = tracker.getVariable('t1')!;
      expect(shadowed.isTranslationFunction).toBe(false);
      expect(shadowed.originalName).toBe('not_a_function');

      // Exit nested scope - shadow should be removed
      tracker.exitScope();

      // Should get original back
      const restored = tracker.getVariable('t1')!;
      expect(restored.isTranslationFunction).toBe(true);
      expect(restored.originalName).toBe('useGT');
      expect(restored.scopeId).toBe(scope1);
    });
  });

  describe('aggressive cleanup on exit', () => {
    it('should aggressively clean up variables and scope info', () => {
      // Enter scope and track variables
      const scope1 = tracker.enterScope();
      tracker.trackTranslationVariable('t1', 'useGT', 0);

      // Enter nested scope
      const scope2 = tracker.enterScope();
      tracker.trackTranslationVariable('t2', 'getGT', 1);

      // Both variables should exist
      expect(tracker.getVariable('t1')).toBeDefined();
      expect(tracker.getVariable('t2')).toBeDefined();

      // Exit nested scope - should remove t2 immediately
      tracker.exitScope();

      // t1 should still be accessible, t2 should not
      expect(tracker.getVariable('t1')).toBeDefined();
      expect(tracker.getVariable('t2')).toBeUndefined();

      // Scope info should also be cleaned up
      expect(tracker.getScopeInfo(scope2)).toBeUndefined();
      expect(tracker.getScopeInfo(scope1)).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty variable names', () => {
      tracker.enterScope();
      tracker.trackTranslationVariable('', 'useGT', 0);

      const variable = tracker.getVariable('');
      expect(variable).toBeDefined();
      expect(variable!.originalName).toBe('useGT');
    });

    it('should handle same variable name with different types', () => {
      tracker.enterScope();

      // Track as translation function first
      tracker.trackTranslationVariable('t', 'useGT', 0);
      let variable = tracker.getVariable('t')!;
      expect(variable.isTranslationFunction).toBe(true);

      // Enter new scope and track as regular variable
      tracker.enterScope();
      tracker.trackRegularVariable('t', 'regularValue');
      variable = tracker.getVariable('t')!;
      expect(variable.isTranslationFunction).toBe(false);
      expect(variable.originalName).toBe('regularValue');

      // Exit scope - should restore translation function
      tracker.exitScope();
      variable = tracker.getVariable('t')!;
      expect(variable.isTranslationFunction).toBe(true);
      expect(variable.originalName).toBe('useGT');
    });

    it('should handle multiple exits without crashes', () => {
      const scope1 = tracker.enterScope();
      const scope2 = tracker.enterScope();

      // Normal exits
      tracker.exitScope();
      tracker.exitScope();

      // Additional exits should not crash (but may log warnings)
      expect(() => tracker.exitScope()).not.toThrow();
      expect(() => tracker.exitScope()).not.toThrow();
    });

    it('should handle variable lookup without any scopes', () => {
      expect(tracker.getVariable('anyVariable')).toBeUndefined();
      expect(tracker.getTranslationVariable('anyVariable')).toBeUndefined();
    });
  });
});
