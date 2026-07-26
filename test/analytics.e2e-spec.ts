import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Analytics (e2e)', () => {
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

    const email = `analytics.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Analytics User' })
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

  it('recomputes snapshots on complete and serves overview/volume/charts', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Analytics Day',
        completed: true,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [
              { setNumber: 1, reps: 5, weight: 100, weightUnit: 'KG' },
              { setNumber: 2, reps: 5, weight: 100, weightUnit: 'KG' },
            ],
          },
        ],
      })
      .expect(201);

    expect(created.body.data.status).toBe('COMPLETED');
    const today = new Date().toISOString().slice(0, 10);
    const from = today;
    const to = today;

    const overview = await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(overview.body.data.totalCompletedWorkouts).toBeGreaterThanOrEqual(1);
    expect(overview.body.data.streak).toBeGreaterThanOrEqual(1);

    const volume = await request(app.getHttpServer())
      .get('/api/v1/analytics/volume')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from, to, period: 'day' })
      .expect(200);

    expect(volume.body.data.points.length).toBeGreaterThanOrEqual(1);
    expect(volume.body.data.points[0].y).toBe(1000);

    const muscle = await request(app.getHttpServer())
      .get('/api/v1/analytics/volume/muscle')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from, to })
      .expect(200);

    expect(muscle.body.data.items.length).toBeGreaterThan(0);

    const chart = await request(app.getHttpServer())
      .get('/api/v1/analytics/charts/volume_over_time')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from, to, interval: 'day' })
      .expect(200);

    expect(chart.body.data.chartType).toBe('volume_over_time');
    expect(chart.body.data.points[0].y).toBe(1000);

    const e1rm = await request(app.getHttpServer())
      .get('/api/v1/analytics/estimated-1rm')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from, to, exerciseId })
      .expect(200);

    expect(e1rm.body.data.points.length).toBeGreaterThan(0);

    const consistency = await request(app.getHttpServer())
      .get('/api/v1/analytics/consistency')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(consistency.body.data.consistency).toBeGreaterThan(0);
  });
});
