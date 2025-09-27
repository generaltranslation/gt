import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { File, Folder, Files } from 'fumadocs-ui/components/files';
import {
  Card as ShadCard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LogoCard,
  LogoCardContainer,
  LogoCardImage,
  LogoCardContent,
  AllLogoCards,
} from '@/components/ui/logocard';
import SupportedLocales from '@/components/SupportedLocales';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { Rate } from '@/components/rate';
import { Metadata } from 'next';
import { getLocale } from 'gt-next/server';
import { Mermaid } from '@/components/mdx/mermaid';

const customMdxComponents = {
  a: (props: React.ComponentProps<'a'>) => (
    <a
      {...props}
      className={'link' + (props.className ? ' ' + props.className : '')}
    />
  ),
  LogoCardContainer,
  LogoCard,
  LogoCardImage,
  LogoCardContent,
  AllLogoCards,
  SupportedLocales,
  Mermaid,
};
export default async function Page(props: {
  params: Promise<{ slug?: string[]; locale: string }>;
}) {
  const { slug } = await props.params;
  const locale = await getLocale();

  const page = source.getPage(slug, locale);
  if (!page) notFound();

  const MDX = page.data.body;

  function TOC() {
    return page ? <InlineTOC items={page.data.toc} /> : null;
  }
  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        style: 'clerk',
      }}
      full={page.data.full}
      editOnGithub={{
        owner: 'General-Translation',
        repo: 'gt',
        sha: 'main',
        path: `apps/docs/content/docs/${locale}/${page.file.path}`,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            Tab,
            Tabs,
            Step,
            Steps,
            Accordion,
            Accordions,
            TypeTable,
            Card,
            Cards,
            File,
            Folder,
            Files,
            ShadCard,
            CardContent,
            CardDescription,
            CardFooter,
            CardHeader,
            CardTitle,
            TOC,
            ...customMdxComponents,
          }}
        />
      </DocsBody>
      <Rate />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams('slug', 'locale');
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await props.params;
  const page = source.getPage(slug, locale);
  if (!page) notFound();

  // Construct the canonical URL path
  const slugPath = slug ? slug.join('/') : '';
  const canonicalPath = `/${locale}/docs/${slugPath}`;

  // Clean up the path (remove trailing slashes, handle empty slugs)
  const cleanCanonicalPath =
    canonicalPath
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/\/+/g, '/') || // Replace multiple slashes with single slash
    '/docs'; // Default to /docs if path is empty

  const section = slug && slug.length > 0 ? slug[0] : '';
  const ogBase = 'https://generaltranslation.com/api/og';
  const theme = 'dark';
  const ogUrl = `${ogBase}?l=${encodeURIComponent(locale)}&t=${encodeURIComponent(
    page.data.title ?? ''
  )}&d=${encodeURIComponent(page.data.description ?? '')}&s=${encodeURIComponent(section)}&theme=${theme}`;

  return {
    title: page.data.title,
    description: page.data.description,
    // Add canonical URL pointing to your main domain
    alternates: {
      canonical: `https://generaltranslation.com${cleanCanonicalPath}`,
    },
    // Optional: Add Open Graph metadata with the canonical URL
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url: `https://generaltranslation.com${cleanCanonicalPath}`,
      images: [ogUrl],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description ?? undefined,
      images: [ogUrl],
    },
  };
}
