import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch branch="morning" morning="Good morning" evening="Good evening" />
      <Branch branch="morning" morning={"Good morning"} evening="Good evening" />
      <Branch branch="morning" morning={`Good morning`} evening="Good evening" />
      <Branch branch="morning" morning={`Good morning`} evening="Good evening">{"default"}</Branch>
      <Branch branch="morning" morning={`Good morning`} evening="Good evening">{`default`}</Branch>
    </T>
  );
}