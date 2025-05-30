import {
  Var,
  Num,
  Currency,
  DateTime,
  T,
  Branch,
  Plural,
} from 'gt-react/client';

// Mock <GTProvider> which throws an error
export function GTProvider({}): React.JSX.Element {
  throw new Error(
    `You're attempting to import the Next.js <GTProvider> in a client component. ` +
      `Are you sure you want to do this? It's better to import <GTProvider> in a file not marked 'use client' so that it can fetch translations on the server. ` +
      `If you really need to put <GTProvider> on the client, import <GTClientProvider> from 'gt-next/client' instead (discouraged when using the Next.js App Router).`
  );
}

// Mock <TX> which throws an error
export function Tx({}): React.JSX.Element {
  throw new Error(
    `You're attempting to use the <Tx> runtime translation component in a client component. ` +
      `This is currently unsupported. Please use <T> with variables, ` +
      `or make sure <Tx> rendered on the server only. `
  );
}

export {
  // GTProvider
  T, // Tx
  Var,
  Num,
  Currency,
  DateTime,
  Branch,
  Plural,
};
