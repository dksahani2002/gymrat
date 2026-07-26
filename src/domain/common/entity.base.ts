/**
 * Marker base for domain entities.
 */
export abstract class Entity<TId extends string = string> {
  constructor(public readonly id: TId) {}
}
