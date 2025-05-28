import path from 'path';
import fs from 'fs/promises';
import { statSync, existsSync } from 'fs';

function extractFrontMatter(content: string) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  if (!match) return {};

  const frontMatterStr = match[1];
  const result: Record<string, string> = {};

  const fields = ['title', 'description'];
  fields.forEach((field) => {
    const match = frontMatterStr.match(new RegExp(`${field}:\\s*([^\n]+)`));
    if (match) {
      result[field] = match[1].trim().replace(/['"]|\\'/g, '');
    }
  });

  return result;
}

function pathToUrl(filePath: string): string {
  // Extract locale from the path
  const localeMatch = filePath.match(/^([a-z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : '';

  // Remove prefix, '.mdx' suffix, and 'index' for index pages
  const cleanPath = filePath
    .replaceAll('\\', '/') // windows support
    .replace(/^[a-z]{2}\//, '')
    .replace(/\/index\.mdx$|\.mdx$/, '');

  // Handle root index file
  if (cleanPath === '') {
    return `https://generaltranslation.com/${locale || 'en'}/docs`;
  }

  // Ensure no duplicate slashes by normalizing the path
  const normalizedPath = cleanPath.replace(/^\/+/, '');

  return `https://generaltranslation.com/${locale || 'en'}/docs/${normalizedPath}.mdx`;
}

async function concatenateMDXDocs(sourceDir: string) {
  console.log(`Starting documentation generation from: ${sourceDir}`);

  // Validate source directory exists
  try {
    const stats = await fs.stat(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error(`Source path ${sourceDir} is not a directory`);
    }
  } catch (error) {
    console.error(
      `Error accessing source directory: ${error instanceof Error ? error?.message : error}`
    );
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), 'public');
  // Ensure output directory exists
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error(
      `Error creating output directory: ${error instanceof Error ? error?.message : error}`
    );
    process.exit(1);
  }

  const mdxFiles: Array<{
    path: string;
    content: string;
    title: string;
    description?: string;
  }> = [];

  async function processDirectory(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Don't skip processing any directories within our path
          // This ensures we traverse all nested directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await processDirectory(fullPath);
          }
          continue;
        }

        if (!entry.name.endsWith('.mdx')) continue;

        // Make sure we're only processing the English content
        // The sourceDir might already be content/docs/en if passed as argument
        const normalizedPath = fullPath.replace(/\\/g, '/');
        if (
          !normalizedPath.includes('/en/') &&
          !normalizedPath.endsWith('/en/index.mdx') &&
          !normalizedPath.endsWith('/en/faqs.mdx')
        ) {
          continue;
        }

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const relativePath = path
            .relative(sourceDir, fullPath)
            .replaceAll('\\', '/');
          const frontMatter = extractFrontMatter(content);

          mdxFiles.push({
            path: relativePath,
            content,
            title: frontMatter.title || path.basename(relativePath, '.mdx'),
            description: frontMatter.description,
          });
        } catch (error) {
          console.error(
            `Error processing file ${fullPath}: ${error instanceof Error ? error?.message : error}`
          );
          // Continue processing other files
        }
      }
    } catch (error) {
      console.error(
        `Error reading directory ${dirPath}: ${error instanceof Error ? error?.message : error}`
      );
      throw error;
    }
  }

  try {
    await processDirectory(sourceDir);

    if (mdxFiles.length === 0) {
      console.warn('No MDX files found in the specified directory');
      return;
    }

    // Write full content with source URLs
    const fullContent = mdxFiles
      .map((file) => {
        const sourceUrl = pathToUrl(file.path);
        const content = file.content;

        // Find the position after the title (h1 or h2)
        const titleMatch = content.match(/^(#|##)\s+.*$/m);
        if (titleMatch) {
          const titleIndex = content.indexOf(titleMatch[0]);
          const beforeTitle = content.slice(
            0,
            titleIndex + titleMatch[0].length
          );
          const afterTitle = content.slice(titleIndex + titleMatch[0].length);
          return `${beforeTitle}\nSource: ${sourceUrl}${afterTitle}`;
        }

        // If no title found, add source URL after frontmatter if it exists
        const frontMatterMatch = content.match(/^---\n[\s\S]*?\n---/m);
        if (frontMatterMatch) {
          const frontMatterIndex = content.indexOf(frontMatterMatch[0]);
          const beforeFrontMatter = content.slice(
            0,
            frontMatterIndex + frontMatterMatch[0].length
          );
          const afterFrontMatter = content.slice(
            frontMatterIndex + frontMatterMatch[0].length
          );
          return `${beforeFrontMatter}\nSource: ${sourceUrl}${afterFrontMatter}`;
        }

        // If neither title nor frontmatter found, prepend source URL
        return `Source: ${sourceUrl}\n\n${content}`;
      })
      .join('\n\n');

    await fs.writeFile(
      path.join(outputDir, 'llms-full.txt'),
      fullContent,
      'utf-8'
    );
    console.log(`Generated llms-full.txt`);

    // Group files by top-level section with simplified structure
    const groupedFiles = mdxFiles.reduce(
      (groups, file) => {
        // Get the first part of the path as the section
        // For the "content/docs/en" path, this would be the first directory after 'en'
        const pathParts = file.path.split('/');

        // Handle root files specially
        if (pathParts.length === 1) {
          const section = pathParts[0].replace('.mdx', '');
          if (!groups[section]) {
            groups[section] = [];
          }
          groups[section].push(file);
          return groups;
        }

        // For all other files, use the first directory as section
        const section = pathParts[0];

        if (!groups[section]) {
          groups[section] = [];
        }
        groups[section].push(file);
        return groups;
      },
      {} as Record<string, typeof mdxFiles>
    );

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

    // Sort groups to ensure consistent order
    const sortedGroups = Object.entries(groupedFiles).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    for (const [group, files] of sortedGroups) {
      // Format section headers for better readability
      const formattedGroup = group
        .split('/')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' › ');

      indexContent.push(`\n## ${formattedGroup}`);

      // Sort files by language and then by title for consistency
      const sortedFiles = [...files].sort((a, b) => {
        // Extract language code from path
        const aLang = a.path.split('/')[0] || 'en';
        const bLang = b.path.split('/')[0] || 'en';

        // First sort by language (with 'en' always first)
        if (aLang === 'en' && bLang !== 'en') return -1;
        if (aLang !== 'en' && bLang === 'en') return 1;
        if (aLang !== bLang) return aLang.localeCompare(bLang);

        // Then sort by title
        return a.title.localeCompare(b.title);
      });

      for (const file of sortedFiles) {
        const url = pathToUrl(file.path);
        indexContent.push(
          `- [${file.title}](${url})${file.description ? ': ' + file.description : ''}`
        );
      }
    }

    try {
      await fs.writeFile(
        path.join(outputDir, 'llms.txt'),
        indexContent.join('\n'),
        'utf-8'
      );
      console.log('Generated llms.txt');
    } catch (error) {
      console.error(
        `Error writing index file: ${error instanceof Error ? error?.message : error}`
      );
      throw error;
    }
  } catch (error) {
    console.error(
      'Fatal error during documentation generation:',
      error instanceof Error ? error?.message : error
    );
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let docsDir = path.join(process.cwd(), 'content/docs');
let localeFilter = ''; // Default to all locales

// Check for explicit path argument
if (args.length > 0 && !args[0].startsWith('--')) {
  docsDir = args[0];
}

// Check for locale filter
const localeArg = args.find((arg) => arg.startsWith('--locale='));
if (localeArg) {
  localeFilter = localeArg.split('=')[1];
}

// If no specific locale was provided via flag but running with 'en' is desired by default
if (!localeFilter) {
  localeFilter = 'en';
}

console.log(
  `Processing docs from: ${docsDir} (locale: ${localeFilter || 'all'})`
);

// If locale filter is specified and not already in the path, append it
if (localeFilter && !docsDir.endsWith(`/${localeFilter}`)) {
  const localeDir = path.join(docsDir, localeFilter);

  // Check if locale directory exists
  if (existsSync(localeDir) && statSync(localeDir).isDirectory()) {
    docsDir = localeDir;
    console.log(`Using locale directory: ${docsDir}`);
  } else {
    console.warn(
      `Locale directory ${localeDir} not found, using base directory.`
    );
  }
}

concatenateMDXDocs(docsDir).catch((error) => {
  console.error(
    'Unhandled error:',
    error instanceof Error ? error?.message : error
  );
  process.exit(1);
});
