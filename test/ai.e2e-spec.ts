import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';

describe('AI Parser (e2e)', () => {
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

    const email = `ai.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'AI User' })
      .expect(201);
    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('parses Bench 80kg 5x5 and resolves Bench Press', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/parse-text')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'Bench 80kg 5x5', unitHint: 'KG' })
      .expect(200);

    expect(response.body.data.workout.exercises).toHaveLength(1);
    expect(response.body.data.workout.exercises[0].sets).toHaveLength(5);
    expect(response.body.data.workout.exercises[0].resolvedExercise.name).toBe(
      'Bench Press',
    );
    expect(response.body.data.confidence).toBeGreaterThan(0.9);
  });

  it('parses multi-exercise text', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/parse-text')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        text: 'Bench 80kg 5x5 then Barbell Row 60kg 3x8',
      })
      .expect(200);

    expect(response.body.data.workout.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 422 for unparseable text', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/parse-text')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'this is not a workout' })
      .expect(422);

    expect(response.body.error.code).toBe('UNPARSEABLE');
  });

  it('parses voice via mock STT', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/parse-voice')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('audio', Buffer.from('fake-audio'), {
        filename: 'clip.webm',
        contentType: 'audio/webm',
      })
      .expect(200);

    expect(response.body.data.transcript).toBeTruthy();
    expect(response.body.data.workout.exercises.length).toBeGreaterThan(0);
  });

  it('returns 501 for OCR stub', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/parse-image')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(501);

    expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('lists parse logs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/parse-logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});
