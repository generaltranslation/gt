import { T, Branch, Var, Num } from "gt-next";
export default function Home() {
  const count = 5;
  return (
    <T>
      <Branch
        branch="type"
        line={
          <>
            <hr />
            Line break
            <br />
            New line
          </>
        }
        image={
          <>
            <img src="test.jpg" alt="Test" />
            Image with <Var>caption</Var>
          </>
        }
        input={
          <>
            <input type="text" placeholder="Input" />
            Field with <Num>{count}</Num>
          </>
        }
      />
    </T>
  );
}