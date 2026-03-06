import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import {
  initializeGT,
  GTProvider,
  getTranslations,
  getLocale,
  LocaleSelector,
} from 'gt-tanstack-start'
import gtConfig from '../../gt.config.json'
import loadTranslations from '../../loadTranslations'

import appCss from '../styles.css?url'

initializeGT({
  ...gtConfig,
  loadTranslations,
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start + General Translation' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: async () => {
    return {
      translations: await getTranslations(),
      locale: getLocale(),
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { translations, locale } = Route.useLoaderData()
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased p-8 max-w-3xl mx-auto">
        <GTProvider translations={translations}>
          <nav className="flex items-center justify-between mb-8 pb-4 border-b">
            <div className="flex gap-4">
              <a href="/" className="font-semibold hover:underline">
                Home
              </a>
              <a href="/about" className="hover:underline">
                About
              </a>
            </div>
            <LocaleSelector />
          </nav>
          {children}
        </GTProvider>
        <Scripts />
      </body>
    </html>
  )
}
