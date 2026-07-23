import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { Route } from './+types/root';
import './app.css';

export function Layout({ children }: { children: React.ReactNode }) {
  // The Layout wraps every render, including the build-time prerender of the
  // SPA shell. It must stay free of gt-react calls: gt-react is a browser-only
  // runtime in this app and is not initialized during the prerender. The lang
  // attribute is static here; a real app can update it client-side from
  // useLocale() inside a child route.
  return (
    <html lang='en'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' type='image/svg+xml' href='/favicon.svg' />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  // Rendered into the prerendered shell and shown until the browser finishes
  // initializing gt-react and hydrating. Kept gt-react free for the same reason
  // as Layout.
  return (
    <div className='loading' aria-live='polite'>
      Loading...
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className='page'>
      <section className='panel'>
        <h1>{message}</h1>
        <p>{details}</p>
      </section>
    </main>
  );
}
