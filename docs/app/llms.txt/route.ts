import { source } from '@/lib/source';

export const revalidate = false;

const indexContent = [
  '# General Translation\n',
  '> General Translation is an entire internationalization (i18n) stack that allows you to ship multilingual apps quickly and easily. ' +
    'It includes open-source developer libraries for React and Next.js, an AI translation service, and a complete infrastructure package for serving translation content.\n',
  'This documentation covers everything from getting started to advanced features, APIs, and best practices for working with General Translation. ' +
    'The documentation is organized into key sections covering different aspects of the General Translation ecosystem.\n',
  'General Translation provides a seamless end-to-end i18n solution that integrates naturally into your development workflow. With minimal configuration, ' +
    'it handles the entire pipeline from content extraction to translation delivery. Developers can write code naturally without cluttering their ' +
    'codebase with complex i18n logic.\n',
  'The core components include:\n\n' +
    '- **gt-react**: Core React library with hooks and components for translations and formatting. Supports in-line translations without the need for a dictionary.\n\n' +
    '- **gt-next**: Extends gt-react with a Next.js integration, providing SSR support, dynamic content translation, and more.\n\n' +
    '- **gtx-cli**: Command-line tool for managing translations and content. Connects to the General Translation API to automatically translate projects with AI. The CLI tool also supports translating different file formats, including JSON, MDX, and Markdown.\n',
];

export async function GET() {
  const scanned: string[] = [];
  scanned.push(indexContent.join('\n'));
  const map = new Map<string, string[]>();

  for (const page of source.getPages()) {
    const dir = page.slugs[0];
    const list = map.get(dir) ?? [];
    if (page.locale === 'en') {
      list.push(
        `- [${page.data.title}](${process.env.NEXT_PUBLIC_HOMEPAGE_URL || 'https://generaltranslation.com'}${page.url}.mdx): ${page.data.description}`
      );
    }
    list.sort();
    map.set(dir, list);
  }

  for (const [key, value] of map) {
    scanned.push(`## ${key}`);
    scanned.push(value.join('\n'));
  }

  return new Response(scanned.join('\n\n'));
}
