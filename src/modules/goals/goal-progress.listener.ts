import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GoalsApplicationService } from '../../application/goals/goals.application-service';
import { BodyWeightLoggedEvent } from '../../domain/body-weight/events/body-weight.events';
import { WorkoutCompletedEvent } from '../../domain/workout/events/workout.events';

/**
 * Re-evaluate active goals when progress inputs change.
 */
@Injectable()
export class GoalProgressListener {
  constructor(private readonly goals: GoalsApplicationService) {}

  @OnEvent('workout.completed')
  async onWorkoutCompleted(event: WorkoutCompletedEvent): Promise<void> {
    await this.goals.evaluateActiveGoals(event.userId);
  }

  @OnEvent('body_weight.logged')
  async onBodyWeightLogged(event: BodyWeightLoggedEvent): Promise<void> {
    await this.goals.evaluateActiveGoals(event.userId);
  }

  @OnEvent('pr.achieved')
  async onPrAchieved(event: { userId: string }): Promise<void> {
    await this.goals.evaluateActiveGoals(event.userId);
  }
}
