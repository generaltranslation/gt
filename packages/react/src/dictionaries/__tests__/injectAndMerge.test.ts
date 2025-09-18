import { describe, it, expect } from 'vitest';
import { injectAndMerge } from '../injectAndMerge';
import { Dictionary } from '../../types/types';

describe('injectAndMerge', () => {
  describe('should successfully inject and merge dictionaries', () => {
    it('should inject and merge simple dictionary at root level', () => {
      const dictionary: Dictionary = {
        existing: 'value',
        target: {
          old: 'old value',
        },
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      const result = injectAndMerge(dictionary, subtree, 'target');

      expect(result).toEqual({
        existing: 'value',
        target: {
          old: 'old value',
          new: 'new value',
        },
      });
    });

    it('should merge overlapping keys with subtree taking precedence', () => {
      const dictionary: Dictionary = {
        target: {
          shared: 'original',
          unique: 'original unique',
        },
      };
      const subtree: Dictionary = {
        shared: 'overwritten',
        newKey: 'new value',
      };

      const result = injectAndMerge(dictionary, subtree, 'target');

      expect(result).toEqual({
        target: {
          shared: 'overwritten',
          unique: 'original unique',
          newKey: 'new value',
        },
      });
    });

    it('should inject and merge into nested dictionary', () => {
      const dictionary: Dictionary = {
        app: {
          user: {
            profile: {
              name: 'John',
              email: 'john@example.com',
            },
            settings: {
              theme: 'dark',
            },
          },
        },
      };
      const subtree: Dictionary = {
        bio: 'Software developer',
        location: 'New York',
      };

      const result = injectAndMerge(dictionary, subtree, 'app.user.profile');

      expect(result).toEqual({
        app: {
          user: {
            profile: {
              name: 'John',
              email: 'john@example.com',
              bio: 'Software developer',
              location: 'New York',
            },
            settings: {
              theme: 'dark',
            },
          },
        },
      });
    });

    it('should inject and merge with deeply nested path', () => {
      const dictionary: Dictionary = {
        level1: {
          level2: {
            level3: {
              level4: {
                existing: 'value',
              },
            },
          },
        },
      };
      const subtree: Dictionary = {
        newKey: 'new value',
        nested: {
          deep: 'deep value',
        },
      };

      const result = injectAndMerge(
        dictionary,
        subtree,
        'level1.level2.level3.level4'
      );

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              level4: {
                existing: 'value',
                newKey: 'new value',
                nested: {
                  deep: 'deep value',
                },
              },
            },
          },
        },
      });
    });

    it('should handle complex nested merging', () => {
      const dictionary: Dictionary = {
        messages: {
          errors: {
            validation: 'Validation error',
          },
          success: {
            saved: 'Saved successfully',
          },
        },
      };
      const subtree: Dictionary = {
        network: 'Network error',
        server: 'Server error',
      };

      const result = injectAndMerge(dictionary, subtree, 'messages.errors');

      expect(result).toEqual({
        messages: {
          errors: {
            validation: 'Validation error',
            network: 'Network error',
            server: 'Server error',
          },
          success: {
            saved: 'Saved successfully',
          },
        },
      });
    });
  });

  describe('should handle dictionary entries in structures', () => {
    it('should preserve dictionary entries during merge', () => {
      const dictionary: Dictionary = {
        messages: {
          greeting: ['Hello {name}', { $context: 'personal' }],
          existing: 'Existing message',
        },
      };
      const subtree: Dictionary = {
        farewell: ['Goodbye {name}', { $context: 'personal' }],
        info: 'Info message',
      };

      const result = injectAndMerge(dictionary, subtree, 'messages');

      expect(result).toEqual({
        messages: {
          greeting: ['Hello {name}', { $context: 'personal' }],
          existing: 'Existing message',
          farewell: ['Goodbye {name}', { $context: 'personal' }],
          info: 'Info message',
        },
      });
    });

    it('should handle mixed entry types in merged subtree', () => {
      const dictionary: Dictionary = {
        ui: {
          buttons: {
            save: 'Save',
          },
        },
      };
      const subtree: Dictionary = {
        cancel: ['Cancel', { $context: 'button' }],
        delete: 'Delete',
        confirm: [
          'Are you sure?',
          { $context: 'confirmation', $_hash: 'abc123' },
        ],
      };

      const result = injectAndMerge(dictionary, subtree, 'ui.buttons');

      expect(result).toEqual({
        ui: {
          buttons: {
            save: 'Save',
            cancel: ['Cancel', { $context: 'button' }],
            delete: 'Delete',
            confirm: [
              'Are you sure?',
              { $context: 'confirmation', $_hash: 'abc123' },
            ],
          },
        },
      });
    });
  });

  describe('should handle error cases', () => {
    it('should throw error when dictionary subtree is undefined', () => {
      const dictionary: Dictionary = {
        existing: 'value',
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      expect(() => injectAndMerge(dictionary, subtree, 'nonexistent')).toThrow(
        'gt-react Error: Dictionary subtree not found for id: "nonexistent"'
      );
    });

    it('should throw error when trying to inject into a dictionary entry', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      expect(() => injectAndMerge(dictionary, subtree, 'greeting')).toThrow(
        'Cannot inject and merge a dictionary entry'
      );
    });

    it('should throw error when trying to inject into array-format dictionary entry', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello world', { $context: 'greeting' }],
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      expect(() => injectAndMerge(dictionary, subtree, 'greeting')).toThrow(
        'Cannot inject and merge a dictionary entry'
      );
    });

    it('should throw error for non-existent nested path', () => {
      const dictionary: Dictionary = {
        level1: {
          level2: 'string value',
        },
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      expect(() =>
        injectAndMerge(dictionary, subtree, 'level1.level2.level3')
      ).toThrow(
        'gt-react Error: Dictionary subtree not found for id: "level1.level2.level3"'
      );
    });

    it('should throw error when path traverses through dictionary entry', () => {
      const dictionary: Dictionary = {
        messages: {
          greeting: 'Hello',
        },
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      expect(() =>
        injectAndMerge(dictionary, subtree, 'messages.greeting.invalid')
      ).toThrow(
        'gt-react Error: Dictionary subtree not found for id: "messages.greeting.invalid"'
      );
    });
  });

  describe('should handle edge cases', () => {
    it('should inject into empty target dictionary', () => {
      const dictionary: Dictionary = {
        target: {},
      };
      const subtree: Dictionary = {
        first: 'first value',
        second: 'second value',
      };

      const result = injectAndMerge(dictionary, subtree, 'target');

      expect(result).toEqual({
        target: {
          first: 'first value',
          second: 'second value',
        },
      });
    });

    it('should merge empty subtree without changing target', () => {
      const dictionary: Dictionary = {
        target: {
          existing: 'value',
          nested: {
            deep: 'deep value',
          },
        },
      };
      const subtree: Dictionary = {};

      const result = injectAndMerge(dictionary, subtree, 'target');

      expect(result).toEqual({
        target: {
          existing: 'value',
          nested: {
            deep: 'deep value',
          },
        },
      });
    });

    it('should preserve original dictionary reference (mutation)', () => {
      const dictionary: Dictionary = {
        target: {
          original: 'value',
        },
      };
      const subtree: Dictionary = {
        new: 'new value',
      };

      const result = injectAndMerge(dictionary, subtree, 'target');

      // The function should mutate the original dictionary
      expect(result).toBe(dictionary);
      expect(dictionary.target).toEqual({
        original: 'value',
        new: 'new value',
      });
    });
  });

  describe('should handle complex real-world scenarios', () => {
    it('should merge user interface translations', () => {
      const dictionary: Dictionary = {
        ui: {
          navigation: {
            home: 'Home',
            about: 'About',
          },
          forms: {
            labels: {
              name: 'Name',
              email: 'Email',
            },
          },
        },
      };
      const subtree: Dictionary = {
        phone: 'Phone Number',
        address: 'Address',
        submit: ['Submit Form', { $context: 'button' }],
      };

      const result = injectAndMerge(dictionary, subtree, 'ui.forms.labels');

      expect(result).toEqual({
        ui: {
          navigation: {
            home: 'Home',
            about: 'About',
          },
          forms: {
            labels: {
              name: 'Name',
              email: 'Email',
              phone: 'Phone Number',
              address: 'Address',
              submit: ['Submit Form', { $context: 'button' }],
            },
          },
        },
      });
    });

    it('should handle merging with overriding values', () => {
      const dictionary: Dictionary = {
        config: {
          api: {
            timeout: '30s',
            retries: '3',
          },
          ui: {
            theme: 'light',
          },
        },
      };
      const subtree: Dictionary = {
        timeout: '60s',
        baseUrl: 'https://api.example.com',
        version: 'v2',
      };

      const result = injectAndMerge(dictionary, subtree, 'config.api');

      expect(result).toEqual({
        config: {
          api: {
            timeout: '60s', // overridden
            retries: '3', // preserved
            baseUrl: 'https://api.example.com', // added
            version: 'v2', // added
          },
          ui: {
            theme: 'light',
          },
        },
      });
    });
  });
});
