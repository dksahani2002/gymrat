import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';

describe('Measurements (e2e)', () => {
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

    const email = `meas.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Meas User' })
      .expect(201);
    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, and soft-deletes measurements', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/measurements')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        measurements: { chest: 102, waist: 81, left_arm: 38.5 },
        recordedAt: '2026-07-26T08:00:00.000Z',
        notes: 'weekly check',
      })
      .expect(201);

    expect(created.body.data.unit).toBe('CM');
    expect(created.body.data.measurements.waist).toBe(81);
    const id = created.body.data.id as string;

    const listed = await request(app.getHttpServer())
      .get('/api/v1/measurements')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listed.body.data.items.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/api/v1/measurements')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ measurements: {} })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/measurements/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get('/api/v1/measurements')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      after.body.data.items.some((item: { id: string }) => item.id === id),
    ).toBe(false);
  });
});
