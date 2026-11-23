import { T, Select } from "gt-next";
export default function Home() {
  return (
    <T>
      <Select value="morning" morning={<div>Good morning</div>} evening={<div>Good evening</div>}/>
    </T>
  );
}