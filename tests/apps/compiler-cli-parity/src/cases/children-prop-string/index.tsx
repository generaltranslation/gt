function Label({ children }: { children?: React.ReactNode }) {
  return <span>{children}</span>;
}

export default function ChildrenPropString() {
  const show = true;
  const items = [{ id: 1 }, { id: 2 }];
  return (
    <div>
      <Label children="Component prop words" />
      <p children="Host prop words" />
      <Label children="," />
      <span children=";" />
      <Label children="" />
      <p children="" />
      <Label children="   " />
      <p children="   " />
      <Label children={'Braces prop words'} />
      <p children={`Template prop words`} />
      <Label children={<b>Element prop words</b>} />
      <p children={<i>Host element prop words</i>} />
      <Label children={[<b key="a">First array words</b>, <i key="b">Second array words</i>]} />
      {show && <Label children="Conditional prop words" />}
      <ul>{items.map((item) => <li key={item.id} children="Listed prop words" />)}</ul>
    </div>
  );
}
