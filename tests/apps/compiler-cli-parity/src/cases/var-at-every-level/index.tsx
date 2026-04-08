export default function VarAtEveryLevel() {
  const a = 'A';
  const b = 'B';
  const c = 'C';
  return (
    <div>
      Top {a}
      <section>
        Mid {b}
        <p>Bottom {c}</p>
      </section>
    </div>
  );
}
