import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';

describe('Users Profile (e2e)', () => {
  let app: INestApplication;
  const password = 'Str0ngPass!';
  let email: string;
  let accessToken: string;

  beforeAll(async () => {
    email = `profile.${Date.now()}@gymrat.app`;

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

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Profile User' })
      .expect(201);

    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('gets and updates profile', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe(email);
    expect(me.body.data.displayName).toBe('Profile User');

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Strong Athlete',
        gender: 'MALE',
        heightValue: 180,
        heightUnit: 'CM',
        fitnessGoal: 'BUILD_MUSCLE',
        activityLevel: 'ACTIVE',
        preferredWeightUnit: 'KG',
        timezone: 'Asia/Kolkata',
        dateOfBirth: '1998-03-20',
      })
      .expect(200);

    expect(updated.body.data.displayName).toBe('Strong Athlete');
    expect(updated.body.data.timezone).toBe('Asia/Kolkata');
    expect(updated.body.data.fitnessGoal).toBe('BUILD_MUSCLE');
    expect(updated.body.data.dateOfBirth).toBe('1998-03-20');
    expect(updated.body.data.age).toBeGreaterThanOrEqual(25);
  });

  it('gets and updates preferences', async () => {
    const prefs = await request(app.getHttpServer())
      .get('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prefs.body.data.preferredWeightUnit).toBeDefined();
    expect(prefs.body.data.notifications.emailEnabled).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        preferredWeightUnit: 'LB',
        notifications: { emailEnabled: false, weeklySummary: false },
      })
      .expect(200);

    expect(updated.body.data.preferredWeightUnit).toBe('LB');
    expect(updated.body.data.notifications.emailEnabled).toBe(false);
    expect(updated.body.data.notifications.weeklySummary).toBe(false);
  });

  it('rejects unauthenticated profile access', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('soft-deletes account and blocks further access', async () => {
    const deleteEmail = `delete.${Date.now()}@gymrat.app`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: deleteEmail, password, displayName: 'Delete Me' })
      .expect(201);

    const token = created.body.data.accessToken as string;
    const refresh = created.body.data.refreshToken as string;

    await request(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: deleteEmail, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh })
      .expect(401);
  });
});
