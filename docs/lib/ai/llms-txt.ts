import { source } from '@/lib/source';
import type { InferPageType } from 'fumadocs-core/source';

export async function getLLMText(page: InferPageType<typeof source>) {
  // Make sure the content has a heading structure
  const content = page.data.content;
  const category =
    {
      react: 'gt-react: General Translation React SDK',
      next: 'gt-next: General Translation Next.js SDK',
      cli: 'gtx-cli: General Translation CLI tool',
      platform: 'General Translation Platform',
      core: 'generaltranslation: General Translation Core SDK',
    }[page.slugs[0]] ?? page.slugs[0];

  return `# ${category}: ${page.data.title}
URL: ${process.env.NEXT_PUBLIC_HOMEPAGE_URL || 'https://generaltranslation.com'}${page.url}.mdx
${content}
`;
}
