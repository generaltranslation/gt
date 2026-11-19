import { Branch, T, Plural, Var, Currency } from "gt-next";

export default function Home() {
  const count = 5;
  const amount = 100.5;
  return (
    <T>
      <Branch
        branch="structure"
        nested={
          <div>
            <Plural
              n={count}
              _1={
                <span>
                  Nested plural: <Var>single</Var>
                </span>
              }
              _2={
                <Branch
                  branch="inner"
                  option1="Double nested!"
                  option2={
                    <>
                      With <Currency currency="USD">{amount}</Currency>
                    </>
                  }
                />
              }
            />
          </div>
        }
        flat="Simple flat content"
      />
    </T>
  );
}