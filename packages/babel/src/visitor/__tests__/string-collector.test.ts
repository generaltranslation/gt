import { describe, it, expect, beforeEach } from 'vitest';
import { StringCollector, TranslationContent, TranslationJsx, TranslationHash } from '../string-collector';

describe('StringCollector', () => {
  let collector: StringCollector;

  beforeEach(() => {
    collector = new StringCollector();
  });

  describe('counter id generation', () => {
    it('global counter increments for each call', () => {
      const counterId1 = collector.incrementCounter();
      const counterId2 = collector.incrementCounter();
      const counterId3 = collector.incrementCounter();

      expect(counterId1).toBe(1);
      expect(counterId2).toBe(2);
      expect(counterId3).toBe(3);

      // Counter should increment properly
      expect(collector.getCounter()).toBe(3);
    });

    it('IDs should be deterministic', () => {
      const collector2 = new StringCollector();
      const counterId1 = collector.incrementCounter();
      const counterId1Again = collector2.incrementCounter();
      
      expect(counterId1).toBe(counterId1Again);
    });
  });

  describe('call initialization and content addition', () => {
    it('should start empty after initialization', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Should start empty
      expect(collector.hasContentForInjection(counterId)).toBe(false);

      const retrieved = collector.getTranslationData(counterId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content.length).toBe(0);
      expect(retrieved!.jsx).toBeUndefined();
      expect(retrieved!.hash).toBeUndefined();
    });

    it('should have content after adding translation content', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      const content: TranslationContent = {
        message: 'Hello world',
        hash: 'abc123',
        id: 'greeting',
        context: undefined,
      };

      collector.setTranslationContent(counterId, content);

      // Should now have content
      expect(collector.hasContentForInjection(counterId)).toBe(true);

      const retrieved = collector.getTranslationData(counterId)!;
      expect(retrieved.content.length).toBe(1);
      expect(retrieved.content[0].message).toBe('Hello world');
      expect(retrieved.content[0].id).toBe('greeting');
      expect(retrieved.jsx).toBeUndefined();
      expect(retrieved.hash).toBeUndefined();
    });
  });

  describe('multiple content items', () => {
    it('should handle multiple content items for same call', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Add multiple content items
      collector.setTranslationContent(counterId, {
        message: 'First',
        hash: 'hash1',
        id: undefined,
        context: undefined,
      });

      collector.setTranslationContent(counterId, {
        message: 'Second',
        hash: 'hash2',
        id: 'second',
        context: 'test',
      });

      const retrieved = collector.getTranslationData(counterId)!;
      expect(retrieved.content.length).toBe(2);
      expect(retrieved.content[0].message).toBe('First');
      expect(retrieved.content[1].message).toBe('Second');
      expect(retrieved.content[1].id).toBe('second');
    });
  });

  describe('multiple separate calls', () => {
    it('should isolate content by unique IDs', () => {
      // Create multiple separate calls - global counter increments
      const counterId1 = collector.incrementCounter(); // 1
      const counterId2 = collector.incrementCounter(); // 2
      const counterId3 = collector.incrementCounter(); // 3

      expect(counterId1).toBe(1);
      expect(counterId2).toBe(2);
      expect(counterId3).toBe(3);

      collector.initializeAggregator(counterId1);
      collector.initializeAggregator(counterId2);
      collector.initializeAggregator(counterId3);

      // Add content to different calls
      collector.setTranslationContent(counterId1, {
        message: 'First Call',
        hash: 'hash1',
        id: undefined,
        context: undefined,
      });

      collector.setTranslationContent(counterId3, {
        message: 'Third Call',
        hash: 'hash3',
        id: undefined,
        context: undefined,
      });

      // Content should be isolated by unique IDs
      const call1 = collector.getTranslationData(counterId1)!;
      const call2 = collector.getTranslationData(counterId2)!;
      const call3 = collector.getTranslationData(counterId3)!;

      expect(call1.content.length).toBe(1);
      expect(call2.content.length).toBe(0); // No content added
      expect(call3.content.length).toBe(1);

      expect(call1.content[0].message).toBe('First Call');
      expect(call3.content[0].message).toBe('Third Call');
    });
  });

  describe('content array creation', () => {
    it('should create array from content items', () => {
      const contents: TranslationContent[] = [
        {
          message: 'Hello',
          hash: 'hash1',
          id: 'greeting',
          context: undefined,
        },
        {
          message: 'World',
          hash: 'hash2',
          id: undefined,
          context: 'global',
        },
      ];

      const array = collector.createContentArray(contents);

      expect(array.length).toBe(2);
      expect(array[0].message).toBe('Hello');
      expect(array[0].$_hash).toBe('hash1');
      expect(array[0].$id).toBe('greeting');
      expect(array[1].message).toBe('World');
      expect(array[1].$_hash).toBe('hash2');
      expect(array[1].$context).toBe('global');
    });
  });

  describe('clear functionality', () => {
    it('should reset all state when cleared', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);
      collector.setTranslationContent(counterId, {
        message: 'Test',
        hash: 'hash',
        id: undefined,
        context: undefined,
      });

      expect(collector.getCounter()).toBe(1);
      expect(collector.hasContentForInjection(counterId)).toBe(true);

      collector.clear();

      expect(collector.getCounter()).toBe(0);
      expect(collector.getTranslationData(counterId)).toBeNull();
    });
  });

  describe('safe out of bounds access', () => {
    it('should return null/false for out-of-bounds access', () => {
      // Test safe access - should return null/false for out-of-bounds
      expect(collector.getTranslationData(0)).toBeNull();
      expect(collector.getTranslationData(999)).toBeNull();
      expect(collector.hasContentForInjection(0)).toBe(false);
      expect(collector.hasContentForInjection(999)).toBe(false);
    });
  });

  describe('translation jsx content', () => {
    it('should handle JSX content', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Add JSX content
      const jsx = StringCollector.createTranslationJsx('jsx-hash-123');
      collector.setTranslationJsx(counterId, jsx);

      // Verify content was added
      expect(collector.hasContentForInjection(counterId)).toBe(true);

      const retrieved = collector.getTranslationData(counterId)!;
      expect(retrieved.content.length).toBe(0); // No t() content
      expect(retrieved.jsx).toBeDefined();
      expect(retrieved.hash).toBeUndefined();

      expect(retrieved.jsx!.hash).toBe('jsx-hash-123');
    });
  });

  describe('translation hash content', () => {
    it('should handle hash-only content', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Add hash-only content
      const hash = StringCollector.createTranslationHash('hash-only-456');
      collector.setTranslationHash(counterId, hash);

      // Verify content was added
      expect(collector.hasContentForInjection(counterId)).toBe(true);

      const retrieved = collector.getTranslationData(counterId)!;
      expect(retrieved.content.length).toBe(0); // No t() content
      expect(retrieved.jsx).toBeUndefined();
      expect(retrieved.hash).toBeDefined();

      expect(retrieved.hash!.hash).toBe('hash-only-456');
    });
  });

  describe('mixed content types', () => {
    it('should handle different types of content in same call', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Add different types of content to the same call
      const content1 = StringCollector.createTranslationContent(
        'Hello from t()',
        'content-hash',
        'content-id',
        undefined
      );

      const content2 = StringCollector.createTranslationContent(
        'Second t() call',
        'content-hash-2',
        undefined,
        'test-context'
      );

      const jsx = StringCollector.createTranslationJsx('jsx-hash');
      const hash = StringCollector.createTranslationHash('simple-hash');

      collector.setTranslationContent(counterId, content1);
      collector.setTranslationContent(counterId, content2);
      collector.setTranslationJsx(counterId, jsx);
      collector.setTranslationHash(counterId, hash);

      // Verify all content was added
      expect(collector.hasContentForInjection(counterId)).toBe(true);

      const retrieved = collector.getTranslationData(counterId)!;

      // Check content array
      expect(retrieved.content.length).toBe(2);
      expect(retrieved.content[0].message).toBe('Hello from t()');
      expect(retrieved.content[0].hash).toBe('content-hash');
      expect(retrieved.content[1].message).toBe('Second t() call');
      expect(retrieved.content[1].hash).toBe('content-hash-2');

      // Check JSX
      expect(retrieved.jsx).toBeDefined();
      expect(retrieved.jsx!.hash).toBe('jsx-hash');

      // Check Hash
      expect(retrieved.hash).toBeDefined();
      expect(retrieved.hash!.hash).toBe('simple-hash');
    });
  });

  describe('helper creation methods', () => {
    it('should create TranslationContent correctly', () => {
      const content = StringCollector.createTranslationContent(
        'Test message',
        'test-hash',
        'test-id',
        'test-context'
      );

      expect(content.message).toBe('Test message');
      expect(content.hash).toBe('test-hash');
      expect(content.id).toBe('test-id');
      expect(content.context).toBe('test-context');
    });

    it('should create TranslationJsx correctly', () => {
      const jsx = StringCollector.createTranslationJsx('jsx-hash');
      expect(jsx.hash).toBe('jsx-hash');
    });

    it('should create TranslationHash correctly', () => {
      const hash = StringCollector.createTranslationHash('simple-hash');
      expect(hash.hash).toBe('simple-hash');
    });
  });

  describe('jsx overwrite behavior', () => {
    it('should overwrite previous JSX when set multiple times', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Set initial JSX
      const jsx1 = StringCollector.createTranslationJsx('first-jsx-hash');
      collector.setTranslationJsx(counterId, jsx1);

      // Verify first JSX is set
      let call = collector.getTranslationData(counterId)!;
      expect(call.jsx).toBeDefined();
      expect(call.jsx!.hash).toBe('first-jsx-hash');

      // Overwrite with second JSX
      const jsx2 = StringCollector.createTranslationJsx('second-jsx-hash');
      collector.setTranslationJsx(counterId, jsx2);

      // Verify second JSX overwrote the first
      call = collector.getTranslationData(counterId)!;
      expect(call.jsx).toBeDefined();
      expect(call.jsx!.hash).toBe('second-jsx-hash');
    });
  });

  describe('hash overwrite behavior', () => {
    it('should overwrite previous hash when set multiple times', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Set initial hash
      const hash1 = StringCollector.createTranslationHash('first-hash');
      collector.setTranslationHash(counterId, hash1);

      // Verify first hash is set
      let call = collector.getTranslationData(counterId)!;
      expect(call.hash).toBeDefined();
      expect(call.hash!.hash).toBe('first-hash');

      // Overwrite with second hash
      const hash2 = StringCollector.createTranslationHash('second-hash');
      collector.setTranslationHash(counterId, hash2);

      // Verify second hash overwrote the first
      call = collector.getTranslationData(counterId)!;
      expect(call.hash).toBeDefined();
      expect(call.hash!.hash).toBe('second-hash');
    });
  });

  describe('multiple content additions', () => {
    it('should preserve order of multiple content items', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Add multiple content items
      for (let i = 1; i <= 5; i++) {
        const content = StringCollector.createTranslationContent(
          `Message ${i}`,
          `hash-${i}`,
          `id-${i}`,
          i % 2 === 0 ? `context-${i}` : undefined
        );
        collector.setTranslationContent(counterId, content);
      }

      // Verify all content items were added
      const call = collector.getTranslationData(counterId)!;
      expect(call.content.length).toBe(5);

      // Verify content order and properties
      for (let i = 0; i < 5; i++) {
        const idx = i + 1;
        expect(call.content[i].message).toBe(`Message ${idx}`);
        expect(call.content[i].hash).toBe(`hash-${idx}`);
        expect(call.content[i].id).toBe(`id-${idx}`);

        if (idx % 2 === 0) {
          expect(call.content[i].context).toBe(`context-${idx}`);
        } else {
          expect(call.content[i].context).toBeUndefined();
        }
      }
    });
  });

  describe('empty call behavior', () => {
    it('should handle empty initialized calls', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Call should be initialized but empty
      const call = collector.getTranslationData(counterId)!;
      expect(call.content.length).toBe(0);
      expect(call.jsx).toBeUndefined();
      expect(call.hash).toBeUndefined();

      // Should have no content to inject
      expect(collector.hasContentForInjection(counterId)).toBe(false);

      // Create content array from empty call
      const array = collector.createContentArray(call.content);
      expect(array.length).toBe(0);
    });
  });

  describe('content array from call', () => {
    it('should create content array only from content items, not JSX or Hash', () => {
      const counterId = collector.incrementCounter();
      collector.initializeAggregator(counterId);

      // Add some content
      collector.setTranslationContent(
        counterId,
        StringCollector.createTranslationContent('First', 'hash1', 'id1', undefined)
      );

      collector.setTranslationContent(
        counterId,
        StringCollector.createTranslationContent('Second', 'hash2', undefined, 'context2')
      );

      // Also add JSX and Hash (these should not appear in content array)
      collector.setTranslationJsx(counterId, StringCollector.createTranslationJsx('jsx-hash'));
      collector.setTranslationHash(counterId, StringCollector.createTranslationHash('simple-hash'));

      // Get the call and create array from its content
      const call = collector.getTranslationData(counterId)!;
      const array = collector.createContentArray(call.content);

      // Array should only contain the 2 content items, not JSX or Hash
      expect(array.length).toBe(2);

      // Verify total counts
      expect(call.content.length).toBe(2);
      expect(call.jsx).toBeDefined();
      expect(call.hash).toBeDefined();
    });
  });

  describe('comprehensive workflow', () => {
    it('should handle complex multi-call workflow', () => {
      // Create 3 separate calls
      const call1Id = collector.incrementCounter(); // 1
      const call2Id = collector.incrementCounter(); // 2
      const call3Id = collector.incrementCounter(); // 3

      collector.initializeAggregator(call1Id);
      collector.initializeAggregator(call2Id);
      collector.initializeAggregator(call3Id);

      // Call 1: Multiple content + JSX + Hash
      collector.setTranslationContent(
        call1Id,
        StringCollector.createTranslationContent('Call1 Content1', 'hash1-1', 'id1-1', undefined)
      );
      collector.setTranslationContent(
        call1Id,
        StringCollector.createTranslationContent('Call1 Content2', 'hash1-2', undefined, 'ctx1-2')
      );
      collector.setTranslationJsx(call1Id, StringCollector.createTranslationJsx('jsx1'));
      collector.setTranslationHash(call1Id, StringCollector.createTranslationHash('simple1'));

      // Call 2: Only content
      collector.setTranslationContent(
        call2Id,
        StringCollector.createTranslationContent('Call2 Only Content', 'hash2', undefined, undefined)
      );

      // Call 3: Only JSX
      collector.setTranslationJsx(call3Id, StringCollector.createTranslationJsx('jsx3'));

      // Verify Call 1
      const call1 = collector.getTranslationData(call1Id)!;
      expect(call1.content.length).toBe(2);
      expect(call1.jsx).toBeDefined();
      expect(call1.hash).toBeDefined();
      expect(collector.hasContentForInjection(call1Id)).toBe(true);

      // Verify Call 2
      const call2 = collector.getTranslationData(call2Id)!;
      expect(call2.content.length).toBe(1);
      expect(call2.jsx).toBeUndefined();
      expect(call2.hash).toBeUndefined();
      expect(collector.hasContentForInjection(call2Id)).toBe(true);

      // Verify Call 3
      const call3 = collector.getTranslationData(call3Id)!;
      expect(call3.content.length).toBe(0);
      expect(call3.jsx).toBeDefined();
      expect(call3.hash).toBeUndefined();
      expect(collector.hasContentForInjection(call3Id)).toBe(true); // JSX counts as content

      // Test content array creation
      const array1 = collector.createContentArray(call1.content);
      const array2 = collector.createContentArray(call2.content);
      const array3 = collector.createContentArray(call3.content);

      expect(array1.length).toBe(2);
      expect(array2.length).toBe(1);
      expect(array3.length).toBe(0);

      // Test clear functionality
      collector.clear();
      expect(collector.getCounter()).toBe(0);
      expect(collector.getTranslationData(call1Id)).toBeNull();
    });
  });
});