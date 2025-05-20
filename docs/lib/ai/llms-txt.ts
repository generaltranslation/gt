import { source } from '@/lib/source';
import type { InferPageType } from 'fumadocs-core/source';

export async function getLLMText(page: InferPageType<typeof source>) {
  // Make sure the content has a heading structure
  const content = page.data.content;

  return `URL: ${process.env.NEXT_PUBLIC_APP_URL}${page.url}.mdx
${content}`;
}
