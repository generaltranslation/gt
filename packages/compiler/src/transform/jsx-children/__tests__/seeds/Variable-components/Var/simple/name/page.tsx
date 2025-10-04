import { T, Var } from "gt-next";
export default function Home() {
  return (
    <T>
      <Var name="test1">test</Var>
      <Var name={"test2"}>test</Var>
      <Var name={`test3`}>test</Var>
    </T>
  );
}