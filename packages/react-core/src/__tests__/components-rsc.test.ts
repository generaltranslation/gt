import { describe, expect, it, vi } from 'vitest';
import { withRequestConditions } from '../components-rsc';

describe('@generaltranslation/react-core/components-rsc', () => {
  it('exports the placeholder RSC component surface', async () => {
    const mod = await import('../components-rsc');
    expect(mod.Select).toBeTypeOf('function');
    expect(mod.GtInternalSelect).toBeTypeOf('function');
    expect(mod.Currency).toBeTypeOf('function');
    expect(mod.GtInternalCurrency).toBeTypeOf('function');
    expect(mod.DateTime).toBeTypeOf('function');
    expect(mod.GtInternalDateTime).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect(mod.GtInternalDerive).toBeTypeOf('function');
    expect(mod.Num).toBeTypeOf('function');
    expect(mod.GtInternalNum).toBeTypeOf('function');
    expect(mod.Ordinal).toBeTypeOf('function');
    expect(mod.GtInternalOrdinal).toBeTypeOf('function');
    expect(mod.Plural).toBeTypeOf('function');
    expect(mod.GtInternalPlural).toBeTypeOf('function');
    expect(mod.RelativeTime).toBeTypeOf('function');
    expect(mod.GtInternalRelativeTime).toBeTypeOf('function');
    expect(mod.RscT).toBeUndefined();
    expect(mod.T).toBeTypeOf('function');
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.GtInternalVar).toBeTypeOf('function');
    expect(mod.getPluralBranch).toBeTypeOf('function');
    expect(mod.prepareT).toBeTypeOf('function');
    expect(mod.createRenderVariable).toBeTypeOf('function');
    expect(mod.renderDefaultChildren).toBeTypeOf('function');
    expect(mod.renderTranslatedChildren).toBeTypeOf('function');
    expect(mod.renderVariable).toBeTypeOf('function');
    expect(mod.renderPreparedT).toBeTypeOf('function');
    // Shared RSC-safe helpers are owned by ./pure.
    expect(mod.getFormatLocales).toBeUndefined();
    expect(mod.createRenderPipeline).toBeUndefined();
    expect(mod.t).toBeUndefined();
  });

  it("gives a bound component the request's conditions each time it renders", () => {
    const Component = Object.assign(
      (props: { children: string; _locale: string; _enableI18n: boolean }) =>
        props,
      { _gtt: { kind: 'translate' } as const }
    );
    const getRequestConditions = vi
      .fn()
      .mockReturnValueOnce({ _locale: 'fr', _enableI18n: true })
      .mockReturnValueOnce({ _locale: 'de', _enableI18n: false });
    const Bound = withRequestConditions(Component, getRequestConditions);

    expect(Bound({ children: 'Save' })).toEqual({
      children: 'Save',
      _locale: 'fr',
      _enableI18n: true,
    });
    expect(Bound({ children: 'Save' })).toEqual({
      children: 'Save',
      _locale: 'de',
      _enableI18n: false,
    });
  });

  it.each([
    [undefined, { kind: 'translate' }],
    [
      { kind: 'translate', automatic: true },
      { kind: 'translate', automatic: true },
    ],
  ] as const)(
    'marks a bound component as %j says, or as the one it wraps',
    (marker, expected) => {
      const Component = Object.assign(() => null, {
        _gtt: { kind: 'translate' } as const,
      });
      const Bound = withRequestConditions(
        Component,
        () => ({ _locale: 'fr', _enableI18n: true }),
        marker
      );

      expect(Bound._gtt).toEqual(expected);
    }
  );
});
