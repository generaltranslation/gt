import { T, Plural, Branch, Num, Currency, DateTime } from "gt-next";
export default function Home() {
  const count = 5;
  const amount = 100.5;
  const date = new Date();
  return (
    <T>
      <div className="container">
        <Plural
          n={count}
          singular={
            <div>
              You have <Num>{count}</Num> item costing{" "}
              <Currency currency="USD">{amount}</Currency>
              on <DateTime>{date}</DateTime> in the
              <Branch
                branch="location"
                home="home folder"
                work={<>work directory</>}
              />
            </div>
          }
          plural={
            <div>
              You have <Num>{count}</Num> items costing{" "}
              <Currency currency="USD">{amount * count}</Currency>
              <>fragments mixed</> with elements
            </div>
          }
        />
      </div>
    </T>
  );
}