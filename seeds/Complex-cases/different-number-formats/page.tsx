import { T, Plural, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Plural
        n={1}
        zero={0}
        one={1}
        two={-1}
        few={3.14159}
        many={1e6}
        other={0xff}
      />
      <Branch
        branch="status"
        active={true}
        inactive={false}
        unknown={null}
        pending=""
      />
      <Plural
        n={1}
        singular="Single 'quotes' inside"
        plural={'Double "quotes" inside'}
        other={`Template with 'both' "types"`}
      />
    </T>

  );
}