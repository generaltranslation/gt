import {
  PortableTextTextBlock,
  PortableTextSpan,
  PortableTextObject,
} from 'sanity';
import { vi } from 'vitest';

// jsdom doesn't provide window.CSS; sanity's form components call
// CSS.supports at module scope when imported.
if (typeof globalThis.CSS === 'undefined') {
  (globalThis as { CSS?: unknown }).CSS = { supports: () => false };
}

let mockTestKey = 0;

vi.mock('@portabletext/block-tools', async () => {
  const originalModule = await vi.importActual<
    typeof import('@portabletext/block-tools')
  >('@portabletext/block-tools');
  return {
    ...originalModule,
    //not ideal but vi.mock('@portabletext/block-tools/src/util/randomKey.ts' is not working
    htmlToBlocks: (
      html: string,
      blockContentType: unknown,
      options: unknown
    ) => {
      const blocks = originalModule.htmlToBlocks(
        html,
        blockContentType as Parameters<typeof originalModule.htmlToBlocks>[1],
        options as Parameters<typeof originalModule.htmlToBlocks>[2]
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
