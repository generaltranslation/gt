import {
  Branch,
  Currency,
  DateTime,
  Derive,
  LocaleSelector,
  Num,
  Plural,
  RegionSelector,
  RelativeTime,
  T,
  Var,
} from 'gt-next';

// Fixture page importing every public gt-next server component export.
// Building this page proves the server entrypoint boundary stays RSC-safe:
// no transitive createContext/hook imports and no client barrel re-exports
// from server code.
export default function ServerExportsPage() {
  return (
    <main>
      <T>Server exports fixture</T>
      <Var>value</Var>
      <Derive>static</Derive>
      <Branch branch='a' a='A'>
        fallback
      </Branch>
      <Plural n={1}>fallback</Plural>
      <Num>{1234.5}</Num>
      <Currency currency='USD'>{10}</Currency>
      <DateTime>{new Date(0)}</DateTime>
      <RelativeTime date={new Date(0)} />
      <LocaleSelector />
      <RegionSelector />
    </main>
  );
}
