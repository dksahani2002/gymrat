import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBusPort } from '../../shared/events/event-bus.port';

@Injectable()
export class NestEventBus implements EventBusPort {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(eventName: string, payload: unknown): Promise<void> {
    await this.emitter.emitAsync(eventName, payload);
  }
}
