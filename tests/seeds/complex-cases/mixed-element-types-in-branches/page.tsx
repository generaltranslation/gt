import { T, Plural, Var, Num, Currency, DateTime } from "gt-next";
export default function Home() {
  const count = 5;
  const amount = 100.5;
  const date = new Date();
  return (
    <T>
      <Plural
        n={count}
        _1={
          <article>
            <h1>Single Item</h1>
            <p>
              Description with <Var>details</Var>
            </p>
            <footer>
              <>
                Footer with <Currency currency="USD">{amount}</Currency>
                <span>
                  and <DateTime>{date}</DateTime>
                </span>
              </>
            </footer>
          </article>
        }
        _2={
          <section>
            <header>
              <h2>
                <Num>{count}</Num> Items
              </h2>
            </header>
            <main>
              <>
                <p>
                  Multiple items totaling{" "}
                  <Currency currency="USD">{amount * count}</Currency>
                </p>
                <ul>
                  <li>
                    Item with <Var>variable</Var>
                  </li>
                </ul>
              </>
            </main>
          </section>
        }
      />
    </T>
  );
}