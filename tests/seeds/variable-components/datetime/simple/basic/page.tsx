import { T, DateTime } from "gt-next";
export default function Home() {
  return (
    <T>
      <DateTime>{new Date()}</DateTime>
    </T>
  );
}