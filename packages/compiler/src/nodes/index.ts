// Types
export type {
  ChoiceNode,
  ResolutionNode,
  ExtractionChild,
  ExtractionElement,
  ExtractionGTProp,
} from './types';

// Type guards
export {
  isChoiceNode,
  isExtractionElement,
  isExtractionGTProp,
} from './guards';

// Traversal
export {
  containsChoiceNode,
  findChoiceNodes,
  recurseIntoExtractionChild,
} from './traversal';

// Multiplication
export { multiply } from './multiply';

// Factory
export {
  createChoiceNode,
  createExtractionElement,
  createExtractionGTProp,
} from './factory';
