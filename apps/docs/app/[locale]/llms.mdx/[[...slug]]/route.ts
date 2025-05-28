import { type NextRequest, NextResponse } from 'next/server';
import { getLLMText } from '@/lib/ai/llms-txt';
import { source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug?: string[]; locale: string }> },
) {
  const { slug, locale } = await params;
  const page = source.getPage(slug, locale);
  if (!page) notFound();

  return new NextResponse(await getLLMText(page));
}

export function generateStaticParams() {
  return source.generateParams();
}