import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { GOOGLE_AUTH_PORT } from '../src/application/identity/ports/google-auth.port';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const password = 'Str0ngPass!';
  let email: string;

  beforeAll(async () => {
    email = `athlete.${Date.now()}@gymrat.app`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_AUTH_PORT)
      .useValue({
        verifyIdToken: jest.fn().mockResolvedValue({
          sub: `google-${Date.now()}`,
          email: `google.${Date.now()}@gymrat.app`,
          emailVerified: true,
          name: 'Google User',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, refreshes, and returns me', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Alex' })
      .expect(201);

    expect(register.body.success).toBe(true);
    expect(register.body.data.accessToken).toBeDefined();
    expect(register.body.data.refreshToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const accessToken = login.body.data.accessToken as string;
    const refreshToken = login.body.data.refreshToken as string;

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe(email);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refreshed.body.data.accessToken).toBeDefined();
    expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('rejects weak passwords on register', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `weak.${Date.now()}@gymrat.app`, password: 'password' })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  it('accepts forgot-password for unknown emails', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@gymrat.app' })
      .expect(202);
  });

  it('logs in with Google ID token via mocked verifier', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ idToken: 'fake-google-id-token-value-12345' })
      .expect(200);

    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.user.email).toContain('@gymrat.app');
  });
});
