import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Calendar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'Str0ngPass!';
  let accessToken: string;
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

    const email = `cal.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Cal User' })
      .expect(201);
    accessToken = register.body.data.accessToken as string;

    const bench = await prisma.exercise.findFirst({
      where: { slug: 'bench-press', deletedAt: null },
    });
    expect(bench).toBeTruthy();
    exerciseId = bench!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns completed + planned days and supports planned CRUD', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Calendar Session',
        completed: true,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [{ setNumber: 1, reps: 5, weight: 60, weightUnit: 'KG' }],
          },
        ],
      })
      .expect(201);

    const planned = await request(app.getHttpServer())
      .post('/api/v1/calendar/planned')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plannedDate: tomorrow, title: 'Legs', notes: 'squats' })
      .expect(201);

    expect(planned.body.data.plannedDate).toBe(tomorrow);
    const plannedId = planned.body.data.id as string;

    const from = today < tomorrow ? today : tomorrow;
    const to = today > tomorrow ? today : tomorrow;

    const calendar = await request(app.getHttpServer())
      .get('/api/v1/calendar')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from, to })
      .expect(200);

    expect(calendar.body.data.days.length).toBeGreaterThanOrEqual(1);
    expect(
      calendar.body.data.days.some(
        (day: { completed: unknown[] }) => day.completed.length > 0,
      ),
    ).toBe(true);
    expect(
      calendar.body.data.days.some((day: { planned: Array<{ id: string }> }) =>
        day.planned.some((p) => p.id === plannedId),
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/calendar/planned/${plannedId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Upper' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/calendar/planned/${plannedId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
