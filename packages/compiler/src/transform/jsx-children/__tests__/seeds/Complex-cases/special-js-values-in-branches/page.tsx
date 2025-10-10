import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T >
    <Branch
      branch="type"
      number={42}
      bigNumber={9007199254740991}
      scientific={1e-20}
      negativeScientific={-1e20}
      hex={0xdeadbeef}
      octal={0o755}
      binary={0b11111111}
    />
  </T>
  );
}