import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Workouts (e2e)', () => {
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

    const email = `workout.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Athlete' })
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

  it('creates, lists, completes, and soft-deletes a workout', async () => {
    const idempotencyKey = `idem-${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Push Day',
        source: 'MANUAL',
        idempotencyKey,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [
              { setNumber: 1, reps: 5, weight: 80, weightUnit: 'KG' },
              { setNumber: 2, reps: 5, weight: 80, weightUnit: 'KG' },
            ],
          },
        ],
      })
      .expect(201);

    expect(created.body.data.title).toBe('Push Day');
    expect(created.body.data.exercises[0].sets[0].weightKg).toBe(80);
    const workoutId = created.body.data.id as string;

    const replay = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Push Day',
        idempotencyKey,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [{ setNumber: 1, reps: 5, weight: 80, weightUnit: 'KG' }],
          },
        ],
      })
      .expect(201);
    expect(replay.body.data.id).toBe(workoutId);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      listed.body.data.items.some((w: { id: string }) => w.id === workoutId),
    ).toBe(true);

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.completedAt).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/api/v1/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('adds sets and normalizes LB to weightKg', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'LB Session',
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [{ setNumber: 1, reps: 5, weight: 225, weightUnit: 'LB' }],
          },
        ],
      })
      .expect(201);

    expect(created.body.data.exercises[0].sets[0].weightKg).toBeCloseTo(
      102.06,
      1,
    );
    const workoutId = created.body.data.id as string;
    const workoutExerciseId = created.body.data.exercises[0].id as string;

    const withSet = await request(app.getHttpServer())
      .post(`/api/v1/workouts/${workoutId}/exercises/${workoutExerciseId}/sets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ setNumber: 2, reps: 3, weight: 230, weightUnit: 'LB' })
      .expect(201);

    expect(withSet.body.data.exercises[0].sets).toHaveLength(2);
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/workouts').expect(401);
  });
});
