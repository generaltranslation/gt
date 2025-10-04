import { Currency, T } from "gt-next";
export default function Home() {
  return (
    <T>
      First sibling
      <Currency currency="USD">{100}</Currency>
    </T>
  );
}