import type { Metadata } from 'next';
import '../global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/[locale]/layout.config';
import { source } from '@/lib/source';
import { GTProvider } from 'gt-next';
import { getLocaleProperties } from 'generaltranslation';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import AnalyticsBanner from '@/components/analytics/AnalyticsBanner';
import { TranslatedSeparator } from '@/components/TranslatedSeparator';

const inter = Inter({
  subsets: ['latin'],
});

export function generateMetadata(): Metadata {
  return {
    title: 'Docs — General Translation',
    description:
      'Documentation for the General Translation internationalization platform',
    icons: {
      icon: [
        {
          media: '(prefers-color-scheme: light)',
          url: '/light-favicon.ico',
          href: '/light-favicon.ico',
        },
        {
          media: '(prefers-color-scheme: dark)',
          url: '/dark-favicon.ico',
          href: '/dark-favicon.ico',
        },
      ],
    },
    keywords: [
      'translation',
      'localization',
      'l10n',
      'i18n',
      'internationalization',
      'automate',
      'next.js',
      'nextjs',
      'react',
    ],
  };
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const options = await baseOptions(locale);
  const locales = ['en', 'zh', 'de', 'fr', 'es', 'ja'].map((locale) => ({
    name: capitalize(getLocaleProperties(locale, locale).languageName),
    locale: locale,
  }));
  const translations = {
    en: (await import('@/content/ui.en.json')).default,
    zh: (await import('@/content/ui.zh.json')).default,
    de: (await import('@/content/ui.de.json')).default,
    fr: (await import('@/content/ui.fr.json')).default,
    es: (await import('@/content/ui.es.json')).default,
    ja: (await import('@/content/ui.ja.json')).default,
  }[locale];
  return (
    <html lang={locale} className={inter.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PostHogProvider>
          <GTProvider locale={locale}>
            <RootProvider
              i18n={{
                locale: locale,
                locales: locales,
                translations: translations,
              }}
            >
              <DocsLayout
                sidebar={{
                  components: {
                    Separator: TranslatedSeparator,
                  },
                  tabs: {
                    transform(option, node) {
                      const meta = source.getNodeMeta(node);
                      if (!meta) return option;
                      const color = `var(--${meta.file.dirname}-color, var(--purple-500, #8b5cf6))`;
                      return {
                        ...option,
                        icon: (
                          <div
                            className="rounded-md p-1 shadow-lg ring-2 [&_svg]:size-5"
                            style={
                              {
                                color,
                                border: `1px solid color-mix(in oklab, ${color} 50%, transparent)`,
                                '--tw-ring-color': `color-mix(in oklab, ${color} 20%, transparent)`,
                              } as object
                            }
                          >
                            {node.icon}
                          </div>
                        ),
                      };
                    },
                  },
                  banner: (
                    <>
                      <a
                        href="https://github.com/generaltranslation/gt"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="px-4 py-2 mb-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-100/20">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <SiGithub />
                            {translations?.starOnGithub || 'Star us on GitHub!'}
                          </h3>
                        </div>
                      </a>
                    </>
                  ),
                }}
                tree={source.pageTree[locale]}
                {...options}
              >
                {children}
              </DocsLayout>
              <AnalyticsBanner />
            </RootProvider>
          </GTProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
