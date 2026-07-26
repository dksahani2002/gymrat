import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';

describe('Body Weight (e2e)', () => {
  let app: INestApplication;
  const password = 'Str0ngPass!';
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    const email = `bw.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'BW User' })
      .expect(201);
    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, charts, and soft-deletes body weight', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/body-weight')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        weight: 82.5,
        unit: 'KG',
        recordedAt: '2026-07-26T08:00:00.000Z',
        notes: 'morning',
      })
      .expect(201);

    expect(created.body.data.weightKg).toBe(82.5);
    expect(created.body.data.notes).toBe('morning');
    const id = created.body.data.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/body-weight')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        weight: 181.5,
        unit: 'LB',
        recordedAt: '2026-07-25T08:00:00.000Z',
      })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/body-weight')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listed.body.data.items.length).toBeGreaterThanOrEqual(2);

    const chart = await request(app.getHttpServer())
      .get('/api/v1/analytics/charts/body_weight_over_time')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from: '2026-07-01', to: '2026-07-31' })
      .expect(200);

    expect(chart.body.data.chartType).toBe('body_weight_over_time');
    expect(chart.body.data.points.length).toBeGreaterThanOrEqual(2);
    expect(
      chart.body.data.points.some((p: { y: number }) => p.y === 82.5),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/body-weight/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get('/api/v1/body-weight')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      after.body.data.items.some((item: { id: string }) => item.id === id),
    ).toBe(false);
  });
});
