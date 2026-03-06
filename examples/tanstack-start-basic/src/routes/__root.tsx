import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import {
  initializeGT,
  GTProvider,
  getTranslations,
  getLocale,
  LocaleSelector,
} from 'gt-tanstack-start'
import gtConfig from '../../gt.config.json'
import loadTranslations from '../../loadTranslations'

// Initialize GT at the module level
initializeGT({
  ...gtConfig,
  loadTranslations,
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start + GT' },
    ],
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
      <body>
        <GTProvider translations={translations}>
          <nav style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            <LocaleSelector />
          </nav>
          {children}
        </GTProvider>
        <Scripts />
      </body>
    </html>
  )
}
