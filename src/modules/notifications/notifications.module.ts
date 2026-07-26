import { Module } from '@nestjs/common';
import { NotificationsApplicationService } from '../../application/notifications/notifications.application-service';
import { NOTIFICATION_REPOSITORY } from '../../domain/notification/repositories/notification.repository';
import { NotificationPrismaRepository } from '../../infrastructure/persistence/repositories/notification.prisma-repository';
import { NotificationEventsListener } from './notification-events.listener';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsApplicationService,
    NotificationEventsListener,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: NotificationPrismaRepository,
    },
  ],
  exports: [NotificationsApplicationService],
})
export class NotificationsModule {}
