import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'Str0ngPass!';
  let accessToken: string;
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const email = `notif.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Notif User' })
      .expect(201);
    accessToken = register.body.data.accessToken as string;
    userId = register.body.data.user.id as string;

    const bench = await prisma.exercise.findFirst({
      where: { slug: 'bench-press', deletedAt: null },
    });
    expect(bench).toBeTruthy();
    exerciseId = bench!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates PR notifications, lists, marks read, prefs, and push tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'PR Session',
        completed: true,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [{ setNumber: 1, reps: 5, weight: 120, weightUnit: 'KG' }],
          },
        ],
      })
      .expect(201);

    const inbox = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(inbox.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    expect(
      inbox.body.data.items.some(
        (n: { type: string }) => n.type === 'pr.achieved',
      ),
    ).toBe(true);

    const notifId = inbox.body.data.items.find(
      (n: { type: string }) => n.type === 'pr.achieved',
    ).id as string;

    const read = await request(app.getHttpServer())
      .post(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(read.body.data.isRead).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const prefs = await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ prAlerts: false })
      .expect(200);

    expect(prefs.body.data.prAlerts).toBe(false);

    const token = await request(app.getHttpServer())
      .post('/api/v1/notifications/push-tokens')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: `device-token-${userId}`, platform: 'ios' })
      .expect(201);

    expect(token.body.data.platform).toBe('ios');
  });
});
