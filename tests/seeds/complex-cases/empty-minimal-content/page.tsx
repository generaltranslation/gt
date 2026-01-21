import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch
        branch="content"
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