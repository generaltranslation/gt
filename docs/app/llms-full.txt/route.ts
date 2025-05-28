import { source } from '@/lib/source';
import { getLLMText } from '@/lib/ai/llms-txt';

export const revalidate = false;

export async function GET() {
  const scan = source
    .getPages()
    .filter((file) => file.locale === 'en')
    .map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
