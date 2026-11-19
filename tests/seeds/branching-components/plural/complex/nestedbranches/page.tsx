import { T, Plural } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural
        n={1}
        one={<Plural n={1} one="Good morning">Good evening</Plural>}
      >Good evening</Plural>
    </T>
  );
}