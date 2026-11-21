import { T, Select } from "gt-next";
export default function Home() {
  return (
    <T>
      <Select value="morning" morning="Good morning" evening="Good evening" />
    </T>
  );
}