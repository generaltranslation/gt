import { T, Plural, Num} from "gt-next";
export default function Home() {
  const count = 1;
  return (
    <T>
      <Plural
        n={1}
        one={<p>There is <Num>count</Num> item</p>}
        other={<p>There are <Num>count</Num> items</p>}
      />
    </T>
  );
}