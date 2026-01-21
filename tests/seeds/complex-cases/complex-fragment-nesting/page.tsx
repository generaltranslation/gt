import { T, Plural, Var, Num, Currency } from "gt-next";


export default function Home() {
  const count = 5;
  const amount = 100.5;
  return (<T>
    <Plural
      n={count}
      singular={
        <>
          Outer fragment
          <>
            Nested fragment with <Var>variable</Var>
            <>
              Deep nested with <Num>{count}</Num>
              {/* <></> */}
              <>More nesting</>
            </>
          </>
          Back to outer
        </>
      }
      plural={
        <div>
          <>Fragment in div</>
          <span>
            <>
              Fragment in span with{" "}
              <Currency currency="USD">{amount}</Currency>
            </>
          </span>
        </div>
      }
    />
  </T>
  );
}