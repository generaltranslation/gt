import { T, Plural } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural n={1} one="Good morning">Good evening</Plural>
      <Plural n={1} one={"Good morning"}>Good evening</Plural>
      <Plural n={1} one={`Good morning`}>Good evening</Plural>
      <Plural n={1} one={`Good morning`}>{"default"}</Plural>
      <Plural n={1} one={`Good morning`}>{`default`}</Plural>
    </T>
  );
}