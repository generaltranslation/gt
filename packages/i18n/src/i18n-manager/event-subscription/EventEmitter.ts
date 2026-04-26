/**
 * Event name type
 */
export type EventName = string;

/**
 * Base event type
 */
type BaseEvent = Record<EventName, unknown>;

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
type ListenerStore<Events extends BaseEvent> = {
  [EventName in keyof Events]: Set<Listener<Events, EventName>>;
};

/**
 * Base class for event emitters
 */
export class EventEmitter<Events extends BaseEvent> {
  /**
   * Events map
   */
  protected listeners: ListenerStore<Events>;

  /**
   * Constructor
   */
  constructor(eventNames: (keyof Events)[]) {
    this.listeners = eventNames.reduce((acc, eventName) => {
      acc[eventName] = new Set();
      return acc;
    }, {} as ListenerStore<Events>);
  }

  /**
   * Subscribe to an event, returns an unsubscribe function
   */
  public subscribe<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>
  ) {
    this.listeners[eventName].add(listener);
    return () => {
      this.listeners[eventName].delete(listener);
    };
  }

  /**
   * Emit an event
   */
  protected emit<EventName extends keyof Events>(
    eventName: EventName,
    event: Events[EventName]
  ) {
    this.listeners[eventName].forEach((subscriber) => subscriber(event));
  }
}
