/**
 * Base class for domain events emitted after successful use cases.
 */
export abstract class DomainEvent {
  readonly occurredAt: Date = new Date();

  abstract readonly eventName: string;
}
