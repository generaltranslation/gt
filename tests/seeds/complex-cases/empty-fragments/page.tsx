import { T, Plural } from "gt-next";
export default function Home() {
  return ( <T>
    <Plural n={1} _1={<></>} _2="files" />
  </T>
  );
}