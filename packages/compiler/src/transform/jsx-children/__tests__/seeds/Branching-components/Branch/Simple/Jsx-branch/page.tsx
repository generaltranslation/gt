import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch branch="morning" morning={<div>Good morning</div>} evening={<div>Good evening</div>}/>
    </T>
  );
}