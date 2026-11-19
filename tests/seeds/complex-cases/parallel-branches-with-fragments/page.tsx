import { T, Plural, Var, Num } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural
        n={1}
        _1={
          <>
            <Var>var1</Var> and <Num>num1</Num>
          </>
        }
        _2={
          <div>
            <Var>var1</Var> and <Num>num1</Num>
          </div>
        }
      />
    </T>
  );
}