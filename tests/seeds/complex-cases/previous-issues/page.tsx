import { T, Plural, Select, Var } from "gt-next";
export default function Home() {
  const count = 5;
  const variable = "test";
  return (<T>
    Normal text <div>nested content</div> more text
    <Plural
      n={count}
      zero="No files"
      one="One file"
      two="Two files"
      few="Few files"
      many="Many files"
      _1={<>Single file</>}
    >Other files</Plural>
    <Select
      value="context"
      option1=""
      option2="   padded   "
      option3={<Var>{variable}</Var>}
      option4={<>fragment content</>}
      option5={<div>element content</div>}
    />
  </T>
  );
}