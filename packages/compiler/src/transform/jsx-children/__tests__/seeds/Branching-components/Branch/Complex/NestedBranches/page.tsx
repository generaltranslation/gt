import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch
        branch="morning"
        morning={<Branch branch="time" morning="Good morning" evening="Good evening" />}
        evening="Good evening"
      />
    </T>
  );
}