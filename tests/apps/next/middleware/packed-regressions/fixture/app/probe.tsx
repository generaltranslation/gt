import Link from 'next/link';
import { headers } from 'next/headers';

export type PageProps = {
  params: Promise<Record<string, string | string[]>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function Probe({
  route,
  params,
  searchParams,
}: PageProps & { route: string }) {
  const values = await params;
  const query = await searchParams;
  const requestHeaders = await headers();
  const links = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && key !== 'next') links.append(key, item);
    }
  }
  const next = typeof query.next === 'string' ? query.next : '/fr/hello';
  return (
    <main>
      <h1>{route}</h1>
      <pre id='route-result'>
        {JSON.stringify({
          route,
          params: values,
          query,
          localeHeader: requestHeaders.get('x-generaltranslation-locale'),
        })}
      </pre>
      <Link prefetch={false} href={`${next}?${links}`}>
        Next route
      </Link>
    </main>
  );
}
