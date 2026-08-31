import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  auth,
  cleanup,
  createTestApp,
  registerUser,
  seedFile,
  type TestUser,
} from './helpers.js';

describe('Authorization and sharing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    owner = await registerUser(app, 'owner');
    outsider = await registerUser(app, 'outsider');
  }, 60_000);

  afterAll(async () => {
    await cleanup(prisma, [owner, outsider]);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  describe('data room access', () => {
    it('lets the owner open their own data room', async () => {
      const response = await api()
        .get(`/datarooms/${owner.dataRoomId}`)
        .set(...auth(owner))
        .expect(200);

      expect(response.body.isOwner).toBe(true);
      expect(response.body.canEdit).toBe(true);
    });

    it('hides another user’s data room behind a 404', async () => {
      await api()
        .get(`/datarooms/${owner.dataRoomId}`)
        .set(...auth(outsider))
        .expect(404);
    });

    it('rejects unauthenticated requests', async () => {
      await api().get(`/datarooms/${owner.dataRoomId}`).expect(401);
    });
  });

  describe('folders', () => {
    it('nests folders and reports the full breadcrumb trail', async () => {
      const legal = await createFolder(owner, 'Legal');
      const contracts = await createFolder(owner, 'Contracts', legal);

      const response = await api()
        .get(`/folders/${contracts}`)
        .set(...auth(owner))
        .expect(200);

      expect(
        response.body.breadcrumbs.map((entry: { name: string }) => entry.name),
      ).toEqual(['My Data Room', 'Legal', 'Contracts']);
    });

    it('refuses a duplicate folder name in the same parent', async () => {
      await createFolder(owner, 'Financials');

      await api()
        .post('/folders')
        .set(...auth(owner))
        .send({ dataRoomId: owner.dataRoomId, name: 'Financials' })
        .expect(409);
    });

    it('counts the whole subtree before deleting it', async () => {
      const root = await createFolder(owner, 'Disposable');
      const child = await createFolder(owner, 'Nested', root);
      await seedFile(prisma, {
        dataRoomId: owner.dataRoomId,
        folderId: child,
        uploadedById: owner.id,
        name: 'inside.pdf',
      });

      const stats = await api()
        .get(`/folders/${root}/stats`)
        .set(...auth(owner))
        .expect(200);

      expect(stats.body).toMatchObject({ folderCount: 1, fileCount: 1 });

      await api()
        .delete(`/folders/${root}`)
        .set(...auth(owner))
        .expect(200);

      await api()
        .get(`/folders/${child}`)
        .set(...auth(owner))
        .expect(404);
    });
  });

  describe('duplicate file names', () => {
    it('never overwrites: renaming onto a taken name returns a suggestion', async () => {
      const folder = await createFolder(owner, 'Duplicates');
      await seedFile(prisma, {
        dataRoomId: owner.dataRoomId,
        folderId: folder,
        uploadedById: owner.id,
        name: 'contract.pdf',
      });
      const second = await seedFile(prisma, {
        dataRoomId: owner.dataRoomId,
        folderId: folder,
        uploadedById: owner.id,
        name: 'other.pdf',
      });

      const conflict = await api()
        .patch(`/files/${second.id}`)
        .set(...auth(owner))
        .send({ name: 'contract.pdf' })
        .expect(409);

      expect(conflict.body.details.suggestedName).toBe('contract (1).pdf');

      const kept = await api()
        .patch(`/files/${second.id}`)
        .set(...auth(owner))
        .send({ name: 'contract.pdf', onConflict: 'keepBoth' })
        .expect(200);

      expect(kept.body.name).toBe('contract (1).pdf');
    });
  });

  describe('permissioned shares', () => {
    it('grants read access to the whole subtree, and revokes it again', async () => {
      const shared = await createFolder(owner, 'Shared');
      const nested = await createFolder(owner, 'Deep', shared);
      const file = await seedFile(prisma, {
        dataRoomId: owner.dataRoomId,
        folderId: nested,
        uploadedById: owner.id,
        name: 'nested.pdf',
      });

      await api()
        .get(`/folders/${nested}`)
        .set(...auth(outsider))
        .expect(404);

      const share = await api()
        .post('/shares')
        .set(...auth(owner))
        .send({
          resourceType: 'FOLDER',
          resourceId: shared,
          email: outsider.email,
        })
        .expect(201);

      // One share on the parent covers everything below it.
      const nestedView = await api()
        .get(`/folders/${nested}`)
        .set(...auth(outsider))
        .expect(200);

      expect(nestedView.body.canEdit).toBe(false);
      expect(nestedView.body.role).toBe('VIEWER');

      await api()
        .get(`/files/${file.id}/preview`)
        .set(...auth(outsider))
        .expect(200);

      // Read-only really is read-only.
      await api()
        .patch(`/files/${file.id}`)
        .set(...auth(outsider))
        .send({ name: 'taken-over.pdf' })
        .expect(403);

      await api()
        .delete(`/folders/${nested}`)
        .set(...auth(outsider))
        .expect(403);

      // A recipient cannot pass the access on.
      await api()
        .post('/shares')
        .set(...auth(outsider))
        .send({
          resourceType: 'FOLDER',
          resourceId: shared,
          email: owner.email,
        })
        .expect(403);

      await api()
        .delete(`/shares/${share.body.id}`)
        .set(...auth(owner))
        .expect(204);

      await api()
        .get(`/folders/${nested}`)
        .set(...auth(outsider))
        .expect(404);

      await api()
        .get(`/files/${file.id}/preview`)
        .set(...auth(outsider))
        .expect(404);
    });

    it('keeps a file share limited to that one file', async () => {
      const folder = await createFolder(owner, 'Single file');
      const file = await seedFile(prisma, {
        dataRoomId: owner.dataRoomId,
        folderId: folder,
        uploadedById: owner.id,
        name: 'only-this.pdf',
      });

      await api()
        .post('/shares')
        .set(...auth(owner))
        .send({ resourceType: 'FILE', resourceId: file.id, email: outsider.email })
        .expect(201);

      await api()
        .get(`/files/${file.id}`)
        .set(...auth(outsider))
        .expect(200);

      // The folder around it stays invisible.
      await api()
        .get(`/folders/${folder}`)
        .set(...auth(outsider))
        .expect(404);
    });
  });

  describe('public links', () => {
    it('serves the shared subtree anonymously until the link is disabled', async () => {
      const folder = await createFolder(owner, 'Public');
      const nested = await createFolder(owner, 'Public nested', folder);
      const file = await seedFile(prisma, {
        dataRoomId: owner.dataRoomId,
        folderId: nested,
        uploadedById: owner.id,
        name: 'public.pdf',
      });

      const link = await api()
        .post('/public-links')
        .set(...auth(owner))
        .send({ resourceType: 'FOLDER', resourceId: folder })
        .expect(201);

      const token = link.body.token as string;
      expect(token).not.toContain(folder);
      expect(token.length).toBeGreaterThanOrEqual(24);

      const view = await api().get(`/public/${token}`).expect(200);
      expect(view.body.name).toBe('Public');

      const items = await api()
        .get(`/public/${token}/items?folderId=${nested}`)
        .expect(200);
      expect(items.body.canEdit).toBe(false);
      expect(items.body.files.items).toHaveLength(1);

      await api().get(`/public/${token}/files/${file.id}/preview`).expect(200);

      // Nothing outside the shared folder is reachable through the link.
      const elsewhere = await createFolder(owner, 'Not shared');
      await api()
        .get(`/public/${token}/items?folderId=${elsewhere}`)
        .expect(404);

      await api()
        .delete(`/public-links/${link.body.id}`)
        .set(...auth(owner))
        .expect(204);

      await api().get(`/public/${token}`).expect(404);
      await api().get(`/public/${token}/items`).expect(404);
    });

    it('reports an unknown token as unavailable', async () => {
      await api().get('/public/definitely-not-a-real-token').expect(404);
    });
  });

  async function createFolder(
    user: TestUser,
    name: string,
    parentFolderId?: string,
  ): Promise<string> {
    const response = await api()
      .post('/folders')
      .set(...auth(user))
      .send({
        dataRoomId: user.dataRoomId,
        name,
        ...(parentFolderId ? { parentFolderId } : {}),
      })
      .expect(201);

    return response.body.id as string;
  }
});
