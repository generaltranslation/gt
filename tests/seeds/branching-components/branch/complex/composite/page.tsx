import { T, Select, Var} from "gt-next";
export default function Home() {
  const name = "John";
  return (
    <T>
      <Select
        value={name}
        John={<p>Good morning <Var>name</Var></p>}
        Rose={<p>Good evening <Var>name</Var></p>}
      />
    </T>
  );
}