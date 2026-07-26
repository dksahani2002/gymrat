export const EVENT_BUS = Symbol('EVENT_BUS');

/**
 * Lightweight in-process event bus port.
 * Implementations may await async listeners (emitAsync).
 */
export interface EventBusPort {
  publish(eventName: string, payload: unknown): void | Promise<void>;
}
