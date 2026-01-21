import { T, Currency } from "gt-next";
export default function Home() {
  return (
    <T>
      <Currency currency="USD">{100}</Currency>
    </T>
  );
}