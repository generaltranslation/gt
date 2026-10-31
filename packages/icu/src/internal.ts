/** Shared by General Translation packages; not a public API, and it may change in any release. */
export { buildMessageTree } from './tree/buildMessageTree';
export type {
  BuiltMessageTree,
  MessageTreeBranch,
  MessageTreeFragment,
  MessageTreeHole,
} from './tree/buildMessageTree';
export { findConflictingFormat } from './convert/convert';
