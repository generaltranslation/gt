import { DateTime, T } from "gt-next";
export default function Home() {
  return (
    <T>
      First sibling
      <DateTime>{new Date()}</DateTime>
    </T>
  );
}