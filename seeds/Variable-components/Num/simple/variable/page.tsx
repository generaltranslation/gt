import { T, Num } from "gt-next";
export default function Home() {
  const test = 100;
  return (
    <T>
      <Num>{test}</Num>
      <Num>{(() => test)()}</Num>
      <Num>{test + 1}</Num>
      <Num>{0}</Num>
    </T>
  );
}