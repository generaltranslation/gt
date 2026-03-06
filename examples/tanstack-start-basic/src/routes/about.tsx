import { createFileRoute } from '@tanstack/react-router'
import { T } from 'gt-react'

export const Route = createFileRoute('/about')({ component: About })

function About() {
  return (
    <main>
      <T>
        <h1 className="text-3xl font-bold mb-4">About</h1>
        <p className="text-lg text-gray-600">
          This example demonstrates gt-tanstack-start, the General Translation
          integration for TanStack Start. It provides automatic i18n with
          server-side rendering support.
        </p>
      </T>
    </main>
  )
}
