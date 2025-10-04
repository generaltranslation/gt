import { T, Branch, Var } from "gt-next";
export default function Home() {
  return (
<T >
<Branch
  branch="format"
  compact={
    <>
      No spaces<Var>here</Var>at all
    </>
  }
  spaced={
    <>
      {" "}
      Lots of spaces <Var> here </Var> everywhere{" "}
    </>
  }
  mixed={
    <>
      Text<span> embedded spaces </span>more text
      <Var> padded var </Var>
      final text
    </>
  }
/>
</T>
  );
}