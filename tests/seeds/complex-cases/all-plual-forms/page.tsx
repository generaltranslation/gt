import { Plural, T } from "gt-next";

export default function Home() {
  const count = 5;
  return (
    <T>
      <Plural
        n={count}
        zero="zero items"
        one="one item"
        two="two items"
        few="few items"
        many="many items"
        other="other items"
        _1="singular form"
        _2="plural form"
      />
    </T>  
  );
}