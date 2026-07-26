import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';

describe('Exercises (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'Str0ngPass!';
  let accessToken: string;

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

    const email = `exercise.${Date.now()}@gymrat.app`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Lifter' })
      .expect(201);
    accessToken = register.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists categories, muscles, and seeded exercises', async () => {
    const categories = await request(app.getHttpServer())
      .get('/api/v1/exercises/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(categories.body.data.length).toBeGreaterThan(0);

    const muscles = await request(app.getHttpServer())
      .get('/api/v1/exercises/muscles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(muscles.body.data.length).toBeGreaterThan(0);

    const list = await request(app.getHttpServer())
      .get('/api/v1/exercises')
      .query({ q: 'bench', limit: 10 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(list.body.data.items.length).toBeGreaterThan(0);
    expect(
      list.body.data.items.some(
        (item: { name: string; aliases: string[] }) =>
          item.name.toLowerCase().includes('bench') ||
          item.aliases.some((a: string) => a.includes('bench')),
      ),
    ).toBe(true);
  });

  it('returns exercise detail with muscles and aliases', async () => {
    const bench = await prisma.exercise.findFirst({
      where: { slug: 'bench-press', deletedAt: null },
    });
    expect(bench).toBeTruthy();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/exercises/${bench!.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(detail.body.data.name).toBe('Bench Press');
    expect(detail.body.data.muscles.length).toBeGreaterThan(0);
    expect(detail.body.data.aliases).toEqual(
      expect.arrayContaining(['bench']),
    );
  });

  it('creates, updates, and soft-deletes a custom exercise', async () => {
    const categories = await request(app.getHttpServer())
      .get('/api/v1/exercises/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const categoryId = categories.body.data[0].id as string;

    const muscles = await request(app.getHttpServer())
      .get('/api/v1/exercises/muscles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const muscleGroupId = muscles.body.data[0].id as string;

    const created = await request(app.getHttpServer())
      .post('/api/v1/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Custom Fly ${Date.now()}`,
        categoryId,
        aliases: ['my fly'],
        muscles: [{ muscleGroupId, role: 'PRIMARY' }],
      })
      .expect(201);

    expect(created.body.data.isCustom).toBe(true);
    const id = created.body.data.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/exercises/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Home gym variation' })
      .expect(200);
    expect(updated.body.data.description).toBe('Home gym variation');

    await request(app.getHttpServer())
      .delete(`/api/v1/exercises/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('requires auth for catalog access', async () => {
    await request(app.getHttpServer()).get('/api/v1/exercises').expect(401);
  });
});
