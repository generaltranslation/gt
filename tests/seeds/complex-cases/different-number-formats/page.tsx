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
      >{0xff}</Plural>
      <Branch
        branch="status"
        active={true}
        inactive={false}
        unknown={null}
        pending=""
      />
      <Plural
        n={1}
        _1="Single 'quotes' inside"
        _2={'Double "quotes" inside'}
      >{`Template with 'both' "types"`}</Plural>
    </T>

  );
}