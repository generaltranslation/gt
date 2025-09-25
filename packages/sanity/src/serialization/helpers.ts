import { PortableTextTextBlock } from 'sanity';

// Helper function to merge multiple blocks
// Prioritize blocks[0]
export function mergeBlocks(blocks: PortableTextTextBlock[]) {
  const mergedBlock = { ...blocks[0] };
  mergedBlock.markDefs = mergedBlock.markDefs ?? [];
  for (const [idx, block] of blocks.entries()) {
    if (idx === 0) {
      continue;
    }
    mergedBlock.children.push(...block.children);
    mergedBlock.markDefs.push(...(block.markDefs ?? []));
  }
  mergedBlock._type = 'block';

  return mergedBlock;
}
