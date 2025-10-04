import { T, Branch, Var, Num } from "gt-next";
export default function Home() {
  const count = 5;
  return (
    <T>
      <Branch
        branch="copy"
        version1={
          <>
            Identical content with <Var>same variable</Var> and{" "}
            <Num>{count}</Num>
          </>
        }
        version2={
          <>
            Identical content with <Var>same variable</Var> and{" "}
            <Num>{count}</Num>
          </>
        }
        different={
          <>
            Different content with <Var>other variable</Var> and{" "}
            <Num>{count + 1}</Num>
          </>
        }
      />
    </T>
  );
}