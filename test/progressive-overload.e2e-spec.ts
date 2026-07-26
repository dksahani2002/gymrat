import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Progressive Overload (e2e)', () => {
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

    const email = `overload.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Overload User' })
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

  it('suggests +2.5kg after a successful bench session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Overload Day',
        completed: true,
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [
              { setNumber: 1, reps: 5, weight: 80, weightUnit: 'KG' },
              { setNumber: 2, reps: 5, weight: 80, weightUnit: 'KG' },
              { setNumber: 3, reps: 5, weight: 80, weightUnit: 'KG' },
            ],
          },
        ],
      })
      .expect(201);

    const one = await request(app.getHttpServer())
      .get(`/api/v1/recommendations/overload/${exerciseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(one.body.data.exerciseSlug).toBe('bench-press');
    expect(one.body.data.baseline.weightKg).toBe(80);
    expect(one.body.data.suggestion.weightKg).toBe(82.5);
    expect(one.body.data.classification).toBe('SUCCESS');

    const list = await request(app.getHttpServer())
      .get('/api/v1/recommendations/overload')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      list.body.data.some(
        (row: { exerciseId: string }) => row.exerciseId === exerciseId,
      ),
    ).toBe(true);
  });

  it('returns 404 for unknown exercise', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/recommendations/overload/00000000-0000-4000-8000-000000000099',
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
