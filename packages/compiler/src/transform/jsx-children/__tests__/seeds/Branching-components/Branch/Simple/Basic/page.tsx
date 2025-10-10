import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch branch="morning" morning="Good morning" evening="Good evening" />
    </T>
  );
}