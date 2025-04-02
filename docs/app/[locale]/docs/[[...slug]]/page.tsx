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
import { getLocale } from 'gt-next/server';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
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
};
export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const locale = await getLocale();
  const page = source.getPage(params.slug, locale);
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
        repo: 'gt-docs',
        sha: 'main',
        path: `content/docs/${locale}/${page.file.path}`,
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
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const locale = await getLocale();
  const page = source.getPage(params.slug, locale);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}

export const dynamic = 'force-dynamic'; // Always render on server at request time
