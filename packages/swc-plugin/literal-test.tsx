import { T, Plural } from "gt-next";

export default function LiteralTest() {
  return (
    <>
      {/* Boolean literals test */}
      <T>
        <Plural n={1} singular={true} plural={false} />
      </T>

      {/* Null literal test */}
      <T>
        <Plural n={1} singular={null} plural="Files" />
      </T>
    </>
  );
}