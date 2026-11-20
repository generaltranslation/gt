function Label({ children }: { children?: React.ReactNode }) {
  return <span>{children}</span>;
}

export default function ChildrenPropInsideMessage() {
  return (
    <div>
      <p>Outer words <Label children="inner prop words" /></p>
      <p>Outer text <Label children={'inner braces words'} /></p>
      <p>Outer template <b children={`inner template words`} /></p>
      <p>Outer count <Label children={42} /></p>
    </div>
  );
}
