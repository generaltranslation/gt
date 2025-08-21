import { describe, it, expect } from 'vitest';
import { createDynamicContentWarning, createDynamicFunctionWarning } from '../errors';

describe('errors', () => {
  describe('createDynamicContentWarning', () => {
    it('creates warning with filename and component name', () => {
      const warning = createDynamicContentWarning('MyComponent.tsx', 'T');
      expect(warning).toBe(
        'gt-next in MyComponent.tsx: <T> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.'
      );
    });

    it('creates warning without filename', () => {
      const warning = createDynamicContentWarning(undefined, 'T');
      expect(warning).toBe(
        'gt-next: <T> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.'
      );
    });

    it('works with different component names', () => {
      const warning = createDynamicContentWarning('App.tsx', 'CustomTranslation');
      expect(warning).toBe(
        'gt-next in App.tsx: <CustomTranslation> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.'
      );
    });

    it('handles empty filename', () => {
      const warning = createDynamicContentWarning('', 'T');
      expect(warning).toBe(
        'gt-next in : <T> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.'
      );
    });

    it('handles empty component name', () => {
      const warning = createDynamicContentWarning('MyComponent.tsx', '');
      expect(warning).toBe(
        'gt-next in MyComponent.tsx: <> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.'
      );
    });
  });

  describe('createDynamicFunctionWarning', () => {
    it('creates warning with filename, function name, and violation type', () => {
      const warning = createDynamicFunctionWarning('MyComponent.tsx', 't', 'template literals');
      expect(warning).toBe(
        'gt-next in MyComponent.tsx: t() function call uses template literals which prevents proper translation key generation. Use string literals instead.'
      );
    });

    it('creates warning without filename', () => {
      const warning = createDynamicFunctionWarning(undefined, 't', 'string concatenation');
      expect(warning).toBe(
        'gt-next: t() function call uses string concatenation which prevents proper translation key generation. Use string literals instead.'
      );
    });

    it('works with different function names', () => {
      const warning = createDynamicFunctionWarning('utils.ts', 'translate', 'dynamic expressions');
      expect(warning).toBe(
        'gt-next in utils.ts: translate() function call uses dynamic expressions which prevents proper translation key generation. Use string literals instead.'
      );
    });

    it('works with different violation types', () => {
      const warning = createDynamicFunctionWarning('App.tsx', 't', 'variable interpolation');
      expect(warning).toBe(
        'gt-next in App.tsx: t() function call uses variable interpolation which prevents proper translation key generation. Use string literals instead.'
      );
    });

    it('handles empty filename', () => {
      const warning = createDynamicFunctionWarning('', 't', 'template literals');
      expect(warning).toBe(
        'gt-next in : t() function call uses template literals which prevents proper translation key generation. Use string literals instead.'
      );
    });

    it('handles empty function name', () => {
      const warning = createDynamicFunctionWarning('MyComponent.tsx', '', 'template literals');
      expect(warning).toBe(
        'gt-next in MyComponent.tsx: () function call uses template literals which prevents proper translation key generation. Use string literals instead.'
      );
    });

    it('handles empty violation type', () => {
      const warning = createDynamicFunctionWarning('MyComponent.tsx', 't', '');
      expect(warning).toBe(
        'gt-next in MyComponent.tsx: t() function call uses  which prevents proper translation key generation. Use string literals instead.'
      );
    });
  });

  describe('message formatting consistency', () => {
    it('both functions follow same filename formatting pattern', () => {
      const contentWarning = createDynamicContentWarning('test.tsx', 'T');
      const functionWarning = createDynamicFunctionWarning('test.tsx', 't', 'templates');

      expect(contentWarning.startsWith('gt-next in test.tsx:')).toBe(true);
      expect(functionWarning.startsWith('gt-next in test.tsx:')).toBe(true);
    });

    it('both functions handle missing filename consistently', () => {
      const contentWarning = createDynamicContentWarning(undefined, 'T');
      const functionWarning = createDynamicFunctionWarning(undefined, 't', 'templates');

      expect(contentWarning.startsWith('gt-next:')).toBe(true);
      expect(functionWarning.startsWith('gt-next:')).toBe(true);
    });

    it('messages contain appropriate context', () => {
      const contentWarning = createDynamicContentWarning('test.tsx', 'T');
      const functionWarning = createDynamicFunctionWarning('test.tsx', 't', 'template literals');

      // Content warning should mention JSX and Var components
      expect(contentWarning).toContain('<Var>');
      expect(contentWarning).toContain('unwrapped dynamic content');
      expect(contentWarning).toContain('translation handling');

      // Function warning should mention translation keys and string literals
      expect(functionWarning).toContain('translation key generation');
      expect(functionWarning).toContain('string literals instead');
    });
  });
});