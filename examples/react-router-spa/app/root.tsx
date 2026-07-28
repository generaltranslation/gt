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
  // Layout wraps every render, including the build-time prerender, so it must stay
  // free of gt-react calls; gt-react is browser-only here. The lang attribute is
  // static, and a child route can update it from useLocale().
  return (
    <html lang='en'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' type='image/x-icon' href='/favicon.ico' />
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
