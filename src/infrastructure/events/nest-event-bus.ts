import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBusPort } from '../../shared/events/event-bus.port';

@Injectable()
export class NestEventBus implements EventBusPort {
  constructor(private readonly emitter: EventEmitter2) {}

  publish(eventName: string, payload: unknown): void {
    this.emitter.emit(eventName, payload);
  }
}
