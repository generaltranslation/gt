/**
 * Event name type
 */
export type EventName = string;

/**
 * Base event type
 */
export type BaseEvent = Record<EventName, unknown>;

/**
 * Listener type
 */
type Listener<
  Events extends BaseEvent,
  EventName extends keyof Events = keyof Events,
> = (event: Events[EventName]) => void;

/**
 * type defining our listener store
 */
type ListenerStore<Events extends BaseEvent> = Partial<{
  [EventName in keyof Events]: Set<Listener<Events, EventName>>;
}>;

/**
 * Base class for event emitters
 */
export class EventEmitter<Events extends BaseEvent> {
  /**
   * Events map
   */
  protected listeners: ListenerStore<Events> = {};

  private getOrCreateListeners<EventName extends keyof Events>(
    eventName: EventName
  ): Set<Listener<Events, EventName>> {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = new Set();
    }
    return this.listeners[eventName]!;
  }

  /**
   * Subscribe to an event, returns an unsubscribe function
   */
  public subscribe<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>
  ) {
    const set = this.getOrCreateListeners(eventName);
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /**
   * Emit an event
   */
  protected emit<EventName extends keyof Events>(
    eventName: EventName,
    event: Events[EventName]
  ) {
    this.listeners[eventName]?.forEach((subscriber) => subscriber(event));
  }
}
