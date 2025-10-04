import { T, Branch, Var, Num, Currency } from "gt-next";
export default function Home() {
  const variable = "test";
  const count = 5;
  const amount = 100.5;
  return (
    <T>
      <Branch
        branch="type"
        option1={
          <div>
            First: <Var>{variable}</Var>
            Second: <Num>{count}</Num>
            Third: <Currency currency="USD">{amount}</Currency>
          </div>
        }
        option2={
          <div>
            First: <Var>{variable}</Var>
            Second: <Num>{count}</Num>
            Third: <Currency currency="USD">{amount}</Currency>
          </div>
        }
      />
    </T>
  );
}