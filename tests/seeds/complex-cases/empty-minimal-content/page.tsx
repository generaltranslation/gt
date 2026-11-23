import { T, Select } from "gt-next";
export default function Home() {
  return (
    <T>
      <Select
        value="content"
        empty=""
        space=" "
        newline={"\n"}
        tab={"\t"}
        minimal={<span></span>}
        singleChar="x"
      />
    </T>
  );
}