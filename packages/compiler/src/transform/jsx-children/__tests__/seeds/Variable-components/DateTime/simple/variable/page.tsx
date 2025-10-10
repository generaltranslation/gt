import { T, DateTime } from "gt-next";
export default function Home() {
  const test = new Date();
  return (
    <T>
      <DateTime>{test}</DateTime>
      <DateTime>{(() => test)()}</DateTime>
      <DateTime>{new Date(test.getTime() + 1)}</DateTime>
      <DateTime>{new Date(0)}</DateTime>
    </T>
  );
}