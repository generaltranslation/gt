import { T, Var } from "gt-next";
export default function Home() {
  const test = "test";
  return (
    <T>
      <Var>{test}</Var>
      <Var>{(() => test)()}</Var>
      <Var>{<div>test</div>}</Var>
      <Var>{}</Var>
    </T>
  );
}