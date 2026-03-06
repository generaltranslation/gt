import { createFileRoute } from '@tanstack/react-router'
import { T } from 'gt-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <T>
        <h1 className="text-3xl font-bold mb-4">
          Welcome to TanStack Start + GT
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          This example demonstrates gt-tanstack-start with local translations.
          Use the locale selector above to switch languages.
        </p>
      </T>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded-lg p-4">
          <T>
            <h2 className="font-semibold mb-2">Wrap with {'<T>'}</h2>
            <p className="text-sm text-gray-500">
              Wrap any JSX content in a {'<T>'} component and it gets translated
              automatically.
            </p>
          </T>
        </div>
        <div className="border rounded-lg p-4">
          <T>
            <h2 className="font-semibold mb-2">Local translations</h2>
            <p className="text-sm text-gray-500">
              Ship translations as JSON files in your build. No CDN or runtime
              API calls needed.
            </p>
          </T>
        </div>
      </div>
    </main>
  )
}
