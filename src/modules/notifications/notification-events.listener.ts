import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsApplicationService } from '../../application/notifications/notifications.application-service';
import { GoalCompletedEvent } from '../../domain/goal/events/goal.events';
import { PersonalRecordAchievedEvent } from '../../domain/personal-record/events/personal-record.events';

@Injectable()
export class NotificationEventsListener {
  constructor(private readonly notifications: NotificationsApplicationService) {}

  @OnEvent('pr.achieved')
  async onPrAchieved(event: PersonalRecordAchievedEvent): Promise<void> {
    const unit = event.unit ?? '';
    await this.notifications.notifyInApp({
      userId: event.userId,
      type: 'pr.achieved',
      title: 'New personal record!',
      body: `${event.type.replace(/_/g, ' ')} — ${event.value}${unit ? ` ${unit}` : ''}`,
      payload: {
        personalRecordId: event.personalRecordId,
        exerciseId: event.exerciseId,
        prType: event.type,
        value: event.value,
        unit: event.unit,
        workoutId: event.workoutId,
      },
      respectPrAlerts: true,
    });
  }

  @OnEvent('goal.completed')
  async onGoalCompleted(event: GoalCompletedEvent): Promise<void> {
    await this.notifications.notifyInApp({
      userId: event.userId,
      type: 'goal.completed',
      title: 'Goal completed',
      body: `You completed a ${event.type.toLowerCase().replace(/_/g, ' ')} goal.`,
      payload: {
        goalId: event.goalId,
        goalType: event.type,
      },
    });
  }
}
