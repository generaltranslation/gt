import { T, Branch, Var} from "gt-next";
export default function Home() {
  const name = "John";
  return (
    <T>
      <Branch
        branch={name}
        John={<p>Good morning <Var>name</Var></p>}
        Rose={<p>Good evening <Var>name</Var></p>}
      />
    </T>
  );
}