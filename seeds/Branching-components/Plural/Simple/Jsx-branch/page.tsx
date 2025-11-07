import { T, Plural } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural n={1} one={<div>Good morning</div>} other={<div>Good evening</div>}/>
    </T>
  );
}