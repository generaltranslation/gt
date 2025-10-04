import { T, Currency } from "gt-next";
export default function Home() {
  const test = 100;
  return (
    <T>
      <Currency currency="USD">{test}</Currency>
      <Currency currency="USD">{(() => test)()}</Currency>
      <Currency currency="USD">{test + 1}</Currency>
      <Currency currency="USD">{0}</Currency>
    </T>
  );
}