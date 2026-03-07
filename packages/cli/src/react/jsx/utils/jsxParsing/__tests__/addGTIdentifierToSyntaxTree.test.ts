import { describe, it, expect } from 'vitest';
import addGTIdentifierToSyntaxTree from '../addGTIdentifierToSyntaxTree.js';
import type { MultipliedTreeNode } from '../types.js';

describe('addGTIdentifierToSyntaxTree', () => {
  describe('Branch data-* attribute filtering', () => {
    it('should filter out data-* attributes from Branch props', () => {
      const tree: MultipliedTreeNode = {
        nodeType: 'element',
        type: 'Branch',
        props: {
          children: 'fallback',
          branch: 'status',
          active: 'Active content',
          inactive: 'Inactive content',
          'data-testid': 'branch-test',
        },
      } as any;

      const result = addGTIdentifierToSyntaxTree(tree);

      // The result should be a JsxElement with a 'd' (GTProp) field
      expect(result).toBeDefined();
      const element = result as any;
      expect(element.d).toBeDefined();
      expect(element.d.t).toBe('b');
      expect(element.d.b).toBeDefined();

      // Branch props should include 'active' and 'inactive'
      expect(element.d.b).toHaveProperty('active');
      expect(element.d.b).toHaveProperty('inactive');

      // data-testid should NOT be in the branches
      expect(element.d.b).not.toHaveProperty('data-testid');
    });

    it('should preserve Branch props when no data-* attributes are present', () => {
      const tree: MultipliedTreeNode = {
        nodeType: 'element',
        type: 'Branch',
        props: {
          children: 'fallback',
          branch: 'status',
          active: 'Active content',
          inactive: 'Inactive content',
        },
      } as any;

      const result = addGTIdentifierToSyntaxTree(tree);

      const element = result as any;
      expect(element.d).toBeDefined();
      expect(element.d.t).toBe('b');
      expect(element.d.b).toHaveProperty('active');
      expect(element.d.b).toHaveProperty('inactive');
    });
  });
});
