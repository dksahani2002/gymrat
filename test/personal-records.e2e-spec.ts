import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Personal Records (e2e)', () => {
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

    const email = `pr.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'PR Athlete' })
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

  it('detects PRs on workout complete and exposes list/summary', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'PR Day',
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [
              { setNumber: 1, reps: 5, weight: 100, weightUnit: 'KG' },
              { setNumber: 2, reps: 3, weight: 110, weightUnit: 'KG' },
            ],
          },
        ],
      })
      .expect(201);

    const workoutId = created.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ exerciseId })
      .expect(200);

    expect(listed.body.data.items.length).toBeGreaterThan(0);
    const types = listed.body.data.items.map(
      (row: { type: string }) => row.type,
    );
    expect(types).toEqual(
      expect.arrayContaining([
        'MAX_WEIGHT',
        'MAX_REPS',
        'MAX_VOLUME',
        'ESTIMATED_1RM',
      ]),
    );
    expect(
      listed.body.data.items.find(
        (row: { type: string }) => row.type === 'MAX_WEIGHT',
      ).value,
    ).toBe(110);

    const summary = await request(app.getHttpServer())
      .get('/api/v1/personal-records/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(summary.body.data.length).toBeGreaterThan(0);
    expect(
      summary.body.data.some(
        (row: { type: string; value: number }) =>
          row.type === 'MAX_WEIGHT' && row.value === 110,
      ),
    ).toBe(true);

    // Completing a weaker session should not add new weight PR
    const weaker = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Deload',
        completed: true,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [{ setNumber: 1, reps: 5, weight: 90, weightUnit: 'KG' }],
          },
        ],
      })
      .expect(201);

    expect(weaker.body.data.status).toBe('COMPLETED');

    const after = await request(app.getHttpServer())
      .get('/api/v1/personal-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ exerciseId, type: 'MAX_WEIGHT' })
      .expect(200);

    expect(after.body.data.items).toHaveLength(1);
    expect(after.body.data.items[0].value).toBe(110);
  });
});
