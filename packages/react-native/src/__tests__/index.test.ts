import { describe, it, expect } from 'vitest';

describe('gt-react-native', () => {
  describe('Basic sanity checks', () => {
    it('should have vitest configured', () => {
      expect(true).toBe(true);
    });

    it('should be able to run tests', () => {
      const x = 1 + 1;
      expect(x).toBe(2);
    });
  });
});
