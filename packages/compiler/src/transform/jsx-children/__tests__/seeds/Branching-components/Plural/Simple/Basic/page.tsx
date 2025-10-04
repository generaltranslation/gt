import { T, Plural } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural n={1} one="Good morning" other="Good evening" />
    </T>
  );
}