import { useState } from 'react';
import { Branch, Currency, Num, Plural, T, useGT, Var } from 'gt-react';

const UNIT_PRICE = 129;
const FILTER_PACK_PRICE = 14;
const PRESETS = ['green', 'oolong', 'coffee'] as const;

type Preset = (typeof PRESETS)[number];

const PRESET_TEMPERATURE: Record<Preset, number> = {
  green: 80,
  oolong: 90,
  coffee: 96,
};

export function OrderPanel() {
  const gt = useGT();
  const [preset, setPreset] = useState<Preset>('coffee');
  const [filters, setFilters] = useState(1);
  const [added, setAdded] = useState(false);

  const presetNames: Record<Preset, string> = {
    green: gt('Green tea'),
    oolong: gt('Oolong'),
    coffee: gt('Coffee'),
  };
  const total = UNIT_PRICE + filters * FILTER_PACK_PRICE;

  return (
    <div className='order'>
      <div className='order-group' role='group' aria-labelledby='preset-label'>
        <p className='gt-label' id='preset-label'>
          {gt('Default preset')}
        </p>
        <div className='options'>
          {PRESETS.map((option) => (
            <button
              key={option}
              type='button'
              className='option'
              aria-pressed={preset === option}
              onClick={() => setPreset(option)}
            >
              {presetNames[option]}
              <span className='option-meta'>
                <Num>{PRESET_TEMPERATURE[option]}</Num> °C
              </span>
            </button>
          ))}
        </div>
        <T>
          <Branch
            branch={preset}
            green={
              <p className='order-note'>
                Heats to 80 °C and holds for 30 minutes. Steep for 2 minutes.
              </p>
            }
            oolong={
              <p className='order-note'>
                Heats to 90 °C and holds for 30 minutes. Steep for 3 minutes.
              </p>
            }
            coffee={
              <p className='order-note'>
                Heats to 96 °C and holds for 60 minutes. Bloom for 30 seconds.
              </p>
            }
          >
            <p className='order-note'>Heats to the set temperature.</p>
          </Branch>
        </T>
      </div>

      <div className='order-group' role='group' aria-labelledby='filter-label'>
        <p className='gt-label' id='filter-label'>
          {gt('Paper filter packs')}
        </p>
        <div className='stepper'>
          <button
            type='button'
            aria-label={gt('Remove one pack')}
            disabled={filters <= 0}
            onClick={() => setFilters(filters - 1)}
          >
            −
          </button>
          <output aria-live='polite'>{filters}</output>
          <button
            type='button'
            aria-label={gt('Add one pack')}
            disabled={filters >= 6}
            onClick={() => setFilters(filters + 1)}
          >
            +
          </button>
        </div>
        <T>
          <p className='order-note'>
            Each pack holds <Num>{100}</Num> filters and costs{' '}
            <Currency currency='USD'>{FILTER_PACK_PRICE}</Currency>.
          </p>
        </T>
      </div>

      <div className='order-total'>
        <T>
          <p>
            One kettle set to <Var>{presetNames[preset]}</Var>, with{' '}
            <Plural
              n={filters}
              zero={<>no filters</>}
              one={<>one filter pack</>}
              other={
                <>
                  <Num>{filters}</Num> filter packs
                </>
              }
            />
            .
          </p>
        </T>
        <p className='total'>
          <Currency currency='USD'>{total}</Currency>
        </p>
      </div>

      <div className='order-actions'>
        <button
          type='button'
          className='gt-button'
          onClick={() => setAdded(true)}
        >
          {gt('Add To Cart')}
        </button>
        <p className='gt-label' aria-live='polite'>
          {added
            ? gt('Added. Your preset is saved to the kettle on first boot.')
            : gt('Every kettle ships with a 2 year warranty.')}
        </p>
      </div>
    </div>
  );
}
