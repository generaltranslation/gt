import { T, Plural, Var, Num, Currency, DateTime } from "gt-next";

export default function Home() {
  const count = 5;
  const amount = 100.5;
  const date = new Date();
  return (
    <T>
      <Plural
        n={count}
        singular={
          <>
            Transaction: <Currency currency="USD">{amount}</Currency> on{" "}
            <DateTime>{date}</DateTime> for <Num>{0.15}</Num> tax with{" "}
            <Var name="reference">REF-123</Var>
          </>
        }
        plural={
          <div>
            <Currency currency="EUR">{amount * count}</Currency> total from{" "}
            <Num>{count}</Num> transactions on <DateTime>{date}</DateTime>
          </div>
        }
      />
    </T>
  );
}