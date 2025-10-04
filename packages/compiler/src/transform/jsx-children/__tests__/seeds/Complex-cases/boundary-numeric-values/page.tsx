import { T, Plural } from "gt-next";
export default function Home() {
  const count = 5;
  return (
    <T>
      <Plural
        n={count}
        zero={0.0}
        one={1e-323} // Smallest positive number
        two={5e-324} // Smallest subnormal
        few={1.7976931348623157e308} // Largest finite
        many={-1.7976931348623157e308} // Largest negative finite
        other={2.2250738585072014e-308} // Smallest normal positive
      />
    </T>
  );
}