import { Select, T } from "gt-next";

export default function Home() {
  return (      <T>
    <Select
      value="type"
      option1=""
      option2={null}
      option3={<></>}
      option4={false}
    />
  </T>
  );
}