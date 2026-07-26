export const EVENT_BUS = Symbol('EVENT_BUS');

/**
 * Lightweight in-process event bus port.
 */
export interface EventBusPort {
  publish(eventName: string, payload: unknown): void;
}
