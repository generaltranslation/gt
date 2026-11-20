import { T } from 'gt-react';

export default function ChildrenPropWhitespace() {
  return (
    <div>
      <p>Escaped lead <b children={'upper line\nlower line'} /></p>
      <p>Template lead <b children={`upper row
        lower row`} /></p>
      <p>Spaced lead <b children={'  spaced\tapart  '} /></p>
      <T children={'hand upper\nhand lower'} />
      <T children={`hand first row
        hand second row`} />
      <T children={'  hand spaced\tapart  '} />
      <p children={'own upper\nown lower'} />
      <p children="  own attribute &amp; entity  " />
      <p>Attribute lead <b children="  inner attribute &amp; entity  " /></p>
    </div>
  );
}
