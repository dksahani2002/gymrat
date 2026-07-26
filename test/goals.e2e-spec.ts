import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Goals (e2e)', () => {
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

    const email = `goals.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Goals User' })
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

  it('supports CRUD, progress, and complete', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'FREQUENCY',
        title: 'Train 2 times',
        targetValue: 2,
        startsAt: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);

    expect(created.body.data.progress.percent).toBe(0);
    const goalId = created.body.data.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Session 1',
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

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(detail.body.data.progress.currentValue).toBeGreaterThanOrEqual(1);

    const strength = await request(app.getHttpServer())
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'STRENGTH',
        title: 'Bench 100kg',
        targetValue: 100,
        exerciseId,
      })
      .expect(201);

    expect(strength.body.data.exerciseSlug).toBe('bench-press');

    await request(app.getHttpServer())
      .post(`/api/v1/goals/${goalId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const completed = await request(app.getHttpServer())
      .get(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.progress.percent).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/goals/${strength.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
