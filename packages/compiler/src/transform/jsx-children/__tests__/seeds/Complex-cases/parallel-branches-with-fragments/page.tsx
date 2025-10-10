import { T, Plural, Var, Num } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural
        n={1}
        singular={
          <>
            <Var>var1</Var> and <Num>num1</Num>
          </>
        }
        plural={
          <div>
            <Var>var1</Var> and <Num>num1</Num>
          </div>
        }
      />
    </T>
  );
}