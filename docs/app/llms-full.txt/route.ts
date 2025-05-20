import { source } from '@/lib/source';
import { getLLMText } from '@/lib/ai/llms-txt';

export const revalidate = false;

export async function GET() {
  try {
    const pages = source.getPages().filter((file) => file.locale === 'en');

    // Process each page and catch errors individually
    const results = await Promise.allSettled(
      pages.map(async (page) => {
        try {
          return await getLLMText(page);
        } catch (error) {
          console.error(`Error processing page ${page.url}:`, error);
          return `# Error processing ${page.url}\n\nThere was an error processing this page.`;
        }
      })
    );

    // Filter out rejected promises and extract values from fulfilled ones
    const scanned = results
      .filter(
        (result): result is PromiseFulfilledResult<string> =>
          result.status === 'fulfilled'
      )
      .map((result) => result.value);

    return new Response(scanned.join('\n\n'));
  } catch (error) {
    console.error('Error generating LLM full text:', error);
    return new Response('Error generating documentation text', { status: 500 });
  }
}
