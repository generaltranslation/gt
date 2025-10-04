import { T, Plural } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural n={1} one="Good morning" other="Good evening" />
      <Plural n={1} one={"Good morning"} other="Good evening" />
      <Plural n={1} one={`Good morning`} other="Good evening" />
      <Plural n={1} one={`Good morning`} other="Good evening">{"default"}</Plural>
      <Plural n={1} one={`Good morning`} other="Good evening">{`default`}</Plural>
    </T>
  );
}