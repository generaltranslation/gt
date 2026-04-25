import { I18nEventEmitter, I18nEvent } from '../EventEmitter';

describe('I18nEventEmitter', () => {
  let emitter: I18nEventEmitter;

  beforeEach(() => {
    emitter = new I18nEventEmitter();
  });

  it('starts at version 0', () => {
    expect(emitter.getVersion()).toBe(0);
  });

  it('bumps version on emit', () => {
    emitter.emit({ type: 'localeChanged', locale: 'fr' });
    expect(emitter.getVersion()).toBe(1);
    emitter.emit({ type: 'translationsLoaded', locale: 'fr' });
    expect(emitter.getVersion()).toBe(2);
  });

  it('notifies subscribers', () => {
    const events: I18nEvent[] = [];
    emitter.subscribe((e) => events.push(e));

    emitter.emit({ type: 'localeChanged', locale: 'de', previousLocale: 'en' });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'localeChanged',
      locale: 'de',
      previousLocale: 'en',
    });
  });

  it('unsubscribe stops notifications', () => {
    const events: I18nEvent[] = [];
    const unsub = emitter.subscribe((e) => events.push(e));

    emitter.emit({ type: 'translationsLoaded', locale: 'fr' });
    expect(events).toHaveLength(1);

    unsub();
    emitter.emit({ type: 'translationsLoaded', locale: 'es' });
    expect(events).toHaveLength(1); // no new event
  });

  it('supports multiple subscribers', () => {
    const events1: I18nEvent[] = [];
    const events2: I18nEvent[] = [];
    emitter.subscribe((e) => events1.push(e));
    emitter.subscribe((e) => events2.push(e));

    emitter.emit({ type: 'translationResolved', locale: 'ja' });
    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
  });
});
