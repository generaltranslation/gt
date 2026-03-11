import { createFileRoute } from '@tanstack/react-router'
import { T } from 'gt-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <T>
        <h1>Welcome to TanStack Start + General Translation</h1>
        <p>
          This example app demonstrates how to use gt-tanstack-start for
          internationalization. Use the locale selector above to switch
          languages.
        </p>
      </T>
      <T>
        <h2>Features</h2>
        <ul>
          <li>Server-side rendered translations</li>
          <li>Local JSON translation files</li>
          <li>Instant language switching</li>
        </ul>
      </T>
    </main>
  )
}
