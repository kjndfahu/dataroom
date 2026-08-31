import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export interface TestUser {
  id: string;
  email: string;
  token: string;
  /** The data room created for the account on registration. */
  dataRoomId: string;
}

/** Boots the real application: guards, pipes and filters included. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

/**
 * Registers a throwaway account. Bearer tokens keep the tests free of cookie
 * juggling; the guard accepts either.
 */
export async function registerUser(
  app: INestApplication,
  label: string,
): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@example.test`;
  const password = 'test-password-123';

  const registration = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, name: `${label} tester`, password })
    .expect(201);

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const token = extractToken(login.headers['set-cookie']);

  const rooms = await request(app.getHttpServer())
    .get('/datarooms')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  return {
    id: registration.body.id as string,
    email,
    token,
    dataRoomId: rooms.body.owned[0].id as string,
  };
}

export function auth(user: TestUser): [string, string] {
  return ['Authorization', `Bearer ${user.token}`];
}

/**
 * Creates a file row directly. Upload paths are covered separately; these tests
 * are about permissions, so they should not depend on object storage.
 */
export async function seedFile(
  prisma: PrismaService,
  input: {
    dataRoomId: string;
    folderId: string | null;
    uploadedById: string;
    name: string;
  },
): Promise<{ id: string; name: string }> {
  const file = await prisma.file.create({
    data: {
      name: input.name,
      originalName: input.name,
      mimeType: 'application/pdf',
      size: BigInt(1024),
      storageKey: `dataroom/${input.dataRoomId}/${randomUUID()}`,
      dataRoomId: input.dataRoomId,
      folderId: input.folderId,
      uploadedById: input.uploadedById,
    },
  });

  return { id: file.id, name: file.name };
}

/** Removing the accounts cascades to their rooms, folders, files and shares. */
export async function cleanup(
  prisma: PrismaService,
  users: TestUser[],
): Promise<void> {
  await prisma.user.deleteMany({
    where: { id: { in: users.map((user) => user.id) } },
  });
}

function extractToken(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const session = cookies.find((cookie) => cookie.startsWith('dataroom_session='));

  if (!session) throw new Error('The login response carried no session cookie.');
  return session.split(';')[0]!.replace('dataroom_session=', '');
}
