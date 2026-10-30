import { Num, T, msg, useGT, useMessages } from 'gt-react/experimental';
import { SharedFooter } from '../components/SharedFooter';

const edition = msg('Harbor guide edition for the winter crossing.');

export function HarborGuidePage() {
  const gt = useGT();
  const m = useMessages();

  return (
    <section className='panel' data-testid='harbor-guide-page'>
      <T>
        <h2>Harbor guide for careful captains</h2>
        <p>
          The guide was first printed in <Num>{1887}</Num>.
        </p>
        <p>
          It was compiled by the keepers of the <em>northern coast</em>.
        </p>
      </T>
      <p data-testid='guide-gt'>
        {gt('Anchorage fees are waived for rescue vessels.')}
      </p>
      <p data-testid='guide-msg'>{m(edition)}</p>
      <SharedFooter />
    </section>
  );
}
