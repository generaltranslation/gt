import {
  PortableTextTextBlock,
  PortableTextSpan,
  PortableTextObject,
} from 'sanity';
import { vi } from 'vitest';

let mockTestKey = 0;

vi.mock('@portabletext/block-tools', async () => {
  const originalModule = await vi.importActual<
    typeof import('@portabletext/block-tools')
  >('@portabletext/block-tools');
  return {
    ...originalModule,
    //not ideal but vi.mock('@sanity/block-tools/src/util/randomKey.ts' is not working
    htmlToBlocks: (html: string, blockContentType: any, options: any) => {
      const blocks = originalModule.htmlToBlocks(
        html,
        blockContentType,
        options
      );
      const newBlocks = blocks.map((block) => {
        const newChildren = (
          block as unknown as PortableTextTextBlock<
            PortableTextSpan | PortableTextObject
          >
        ).children.map((child) => {
          return { ...child, _key: `randomKey-${mockTestKey++}` };
        });
        return {
          ...block,
          children: newChildren,
          _key: `randomKey-${mockTestKey++}`,
        };
      });
      return newBlocks;
    },
  };
});
