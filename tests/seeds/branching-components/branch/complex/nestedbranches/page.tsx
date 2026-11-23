import { T, Select } from "gt-next";
export default function Home() {
  return (
    <T>
      <Select
        value="morning"
        morning={<Select value="time" morning="Good morning" evening="Good evening" />}
        evening="Good evening"
      />
    </T>
  );
}