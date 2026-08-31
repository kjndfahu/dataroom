import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { buildSamplePdf } from './sample-pdf.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.S3_BUCKET!;

const DEMO_PASSWORD = 'demo1234';

const OWNER = {
  email: 'demo@dataroom.app',
  name: 'Demo User',
};

const COLLABORATOR = {
  email: 'viewer@dataroom.app',
  name: 'Vera Viewer',
};

/** folder path -> files to place inside it */
const CONTENT: Array<{
  path: string[];
  files: Array<{ name: string; title: string; body: string[] }>;
}> = [
  {
    path: ['Legal', 'Contracts'],
    files: [
      {
        name: 'Acquisition Agreement.pdf',
        title: 'Acquisition Agreement',
        body: [
          'This agreement is made between Acme Corp and Northwind Ltd.',
          'Closing is subject to customary conditions precedent.',
        ],
      },
      {
        name: 'NDA.pdf',
        title: 'Mutual Non-Disclosure Agreement',
        body: ['Effective for a period of three years from the date below.'],
      },
    ],
  },
  {
    path: ['Legal', 'IP'],
    files: [
      {
        name: 'Trademark Register.pdf',
        title: 'Trademark Register',
        body: ['ACME word mark, classes 9 and 42.'],
      },
    ],
  },
  {
    path: ['Financials'],
    files: [
      {
        name: 'Q4 Report.pdf',
        title: 'Q4 Financial Report',
        body: ['Revenue: 12.4M', 'EBITDA: 3.1M', 'Cash position: 8.7M'],
      },
      {
        name: 'Cap Table.pdf',
        title: 'Capitalisation Table',
        body: ['Founders 62%', 'Seed investors 23%', 'Option pool 15%'],
      },
    ],
  },
  {
    path: ['HR'],
    files: [
      {
        name: 'Employee Handbook.pdf',
        title: 'Employee Handbook',
        body: ['Welcome to Acme Corp.'],
      },
    ],
  },
];

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const owner = await prisma.user.upsert({
    where: { email: OWNER.email },
    update: { name: OWNER.name, passwordHash },
    create: { ...OWNER, passwordHash },
  });

  await prisma.user.upsert({
    where: { email: COLLABORATOR.email },
    update: { name: COLLABORATOR.name, passwordHash },
    create: { ...COLLABORATOR, passwordHash },
  });

  await resetDataRooms(owner.id);

  const dataRoom = await prisma.dataRoom.create({
    data: { name: 'Acquisition Data Room', ownerId: owner.id },
  });

  const folderIds = new Map<string, string>();

  async function ensureFolder(path: string[]): Promise<string> {
    const key = path.join('/');
    const cached = folderIds.get(key);
    if (cached) return cached;

    const parentId =
      path.length > 1 ? await ensureFolder(path.slice(0, -1)) : null;

    const folder = await prisma.folder.create({
      data: {
        name: path[path.length - 1]!,
        dataRoomId: dataRoom.id,
        parentFolderId: parentId,
      },
    });

    folderIds.set(key, folder.id);
    return folder.id;
  }

  for (const group of CONTENT) {
    const folderId = await ensureFolder(group.path);

    for (const file of group.files) {
      const pdf = buildSamplePdf(file.title, file.body);
      const storageKey = `dataroom/${dataRoom.id}/${randomUUID()}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: pdf,
          ContentType: 'application/pdf',
        }),
      );

      await prisma.file.create({
        data: {
          name: file.name,
          originalName: file.name,
          mimeType: 'application/pdf',
          size: BigInt(pdf.byteLength),
          storageKey,
          dataRoomId: dataRoom.id,
          folderId,
          uploadedById: owner.id,
        },
      });
    }
  }

  const [folderCount, fileCount] = await Promise.all([
    prisma.folder.count({ where: { dataRoomId: dataRoom.id } }),
    prisma.file.count({ where: { dataRoomId: dataRoom.id } }),
  ]);

  console.log(
    [
      'Seed complete.',
      `  Data room: ${dataRoom.name} (${folderCount} folders, ${fileCount} files)`,
      `  Owner:     ${OWNER.email} / ${DEMO_PASSWORD}`,
      `  Viewer:    ${COLLABORATOR.email} / ${DEMO_PASSWORD}`,
    ].join('\n'),
  );
}

/**
 * Re-running the seed must not leave orphaned blobs behind, so storage objects
 * are removed before the rows that point at them.
 */
async function resetDataRooms(ownerId: string): Promise<void> {
  const files = await prisma.file.findMany({
    where: { dataRoom: { ownerId } },
    select: { storageKey: true },
  });

  for (let i = 0; i < files.length; i += 1000) {
    const chunk = files.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((file) => ({ Key: file.storageKey })) },
      }),
    );
  }

  await prisma.dataRoom.deleteMany({ where: { ownerId } });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
