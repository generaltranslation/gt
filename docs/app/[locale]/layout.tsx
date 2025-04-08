import type { Metadata } from 'next';
import '../global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/[locale]/layout.config';
import { source } from '@/lib/source';
import { I18nProvider } from 'fumadocs-ui/i18n';
import { GTProvider } from 'gt-next';
import { getLocaleProperties } from 'generaltranslation';
import { SiGithub } from '@icons-pack/react-simple-icons';

const inter = Inter({
  subsets: ['latin'],
});

export function generateMetadata(): Metadata {
  return {
    title: 'Docs — General Translation',
    description: 'Documentation for the General Translation i18n stack.',
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
  const locales = [
    {
      name: capitalize(getLocaleProperties('en', 'en').languageName),
      locale: 'en',
    },
    {
      name: capitalize(getLocaleProperties('zh', 'zh').languageName),
      locale: 'zh',
    },
    {
      name: capitalize(getLocaleProperties('de', 'de').languageName),
      locale: 'de',
    },
    {
      name: capitalize(getLocaleProperties('fr', 'fr').languageName),
      locale: 'fr',
    },
    {
      name: capitalize(getLocaleProperties('es', 'es').languageName),
      locale: 'es',
    },
    {
      name: capitalize(getLocaleProperties('ja', 'ja').languageName),
      locale: 'ja',
    },
  ];
  return (
    <html lang={locale} className={inter.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <I18nProvider
          locale={locale}
          locales={locales}
          translations={
            {
              en: (await import('@/content/ui.en.json')).default,
              zh: (await import('@/content/ui.zh.json')).default,
              de: (await import('@/content/ui.de.json')).default,
              fr: (await import('@/content/ui.fr.json')).default,
              es: (await import('@/content/ui.es.json')).default,
              ja: (await import('@/content/ui.ja.json')).default,
            }[locale]
          }
        >
          <GTProvider locale={locale}>
            <RootProvider>
              <DocsLayout
                sidebar={{
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
                        href="https://github.com/General-Translation/gt-next"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="px-4 py-2 mb-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-100/20">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <SiGithub />
                            Star us on GitHub!
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
            </RootProvider>
          </GTProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
